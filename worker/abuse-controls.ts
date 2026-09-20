export type AbuseScope =
    | 'otp_ip'
    | 'otp_email'
    | 'account_ip'
    | 'pair_user'
    | 'pair_ip'
    | 'public_user';

export type AbusePolicy = {
    scope: AbuseScope;
    windowSeconds: number;
    challengeAfter: number;
    blockAfter: number;
    action: 'otp' | 'pair_create' | 'public_generate';
};

export interface AbuseRepository {
    increment(scope: AbuseScope, key: string, now: Date, windowSeconds: number): Promise<number>;
}

export type TurnstileBindings = {
    TURNSTILE_SECRET?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_HOSTNAMES?: string;
};

type SiteverifyResult = {
    success?: boolean;
    action?: string;
    hostname?: string;
};

const digest = async (value: string) => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');
};

export const createAbuseRepository = (database: D1Database): AbuseRepository => ({
    async increment(scope, key, now, windowSeconds) {
        const windowMs = windowSeconds * 1000;
        const windowStartedAt = Math.floor(now.getTime() / windowMs) * windowMs;
        const result = await database
            .prepare(
                `INSERT INTO abuse_window
                    (scope, key_hash, window_started_at, request_count)
                 VALUES (?, ?, ?, 1)
                 ON CONFLICT (scope, key_hash, window_started_at)
                 DO UPDATE SET request_count = request_count + 1
                 RETURNING request_count`,
            )
            .bind(scope, await digest(key), windowStartedAt)
            .first<{ request_count: number }>();
        return result?.request_count || 1;
    },
});

export const verifyTurnstile = async (
    environment: TurnstileBindings,
    input: { token: string; action: AbusePolicy['action']; ipAddress: string },
) => {
    const hostnames = new Set(
        (environment.TURNSTILE_HOSTNAMES || '')
            .split(',')
            .map((hostname) => hostname.trim())
            .filter(Boolean),
    );
    if (
        !environment.TURNSTILE_SECRET ||
        !input.token ||
        input.token.length > 2048 ||
        hostnames.size === 0
    ) {
        return false;
    }
    try {
        const response = await fetch(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                signal: AbortSignal.timeout(10_000),
                body: new URLSearchParams({
                    secret: environment.TURNSTILE_SECRET,
                    response: input.token,
                    remoteip: input.ipAddress,
                }),
            },
        );
        if (!response.ok) return false;
        const result = (await response.json()) as SiteverifyResult;
        return Boolean(
            result.success &&
                result.action === input.action &&
                result.hostname &&
                hostnames.has(result.hostname),
        );
    } catch {
        return false;
    }
};

export const evaluateAbuse = async (
    repository: AbuseRepository,
    policies: AbusePolicy[],
    keys: Partial<Record<AbuseScope, string>>,
    now: Date,
) => {
    let requiresChallenge = false;
    for (const policy of policies) {
        const key = keys[policy.scope];
        if (!key) continue;
        const count = await repository.increment(
            policy.scope,
            key,
            now,
            policy.windowSeconds,
        );
        if (count > policy.blockAfter) return 'blocked' as const;
        if (count > policy.challengeAfter) requiresChallenge = true;
    }
    return requiresChallenge ? ('challenge' as const) : ('allow' as const);
};
