import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { EmailDeliveryError, sendEmail } from './email-delivery';
import { renderOtpEmail } from './email-template';

export const OTP_EXPIRES_IN_SECONDS = 10 * 60;
export const OTP_ALLOWED_ATTEMPTS = 5;
export const OTP_RESEND_DELAY_SECONDS = 60;
export const SESSION_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

export type AuthSession = {
    user: {
        id: string;
        name: string;
        email: string;
    };
};

export interface AuthRuntime {
    handler(request: Request): Promise<Response>;
    getSession(headers: Headers): Promise<AuthSession | null>;
    sendSignInOtp(email: string, ipAddress: string): Promise<void>;
    sendPrivacyOtp?(userId: string, email: string, ipAddress: string): Promise<void>;
    verifyPrivacyOtp?(userId: string, otp: string): Promise<boolean>;
    consumePrivacyAuthorization?(userId: string): Promise<boolean>;
}

export type AuthBindings = {
    DB: D1Database;
    BETTER_AUTH_SECRET: string;
    RESEND_API_KEY: string;
    EMAIL_FROM: string;
};

const digest = async (value: string) => {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');
};

export class OtpRequestError extends Error {
    constructor(
        readonly code: 'OTP_RESEND_DELAY' | 'OTP_DELIVERY_FAILED',
        readonly status: 429 | 503,
        message: string,
    ) {
        super(message);
    }
}

const reserveSend = async (
    database: D1Database,
    table: 'otp_email_limit' | 'otp_ip_limit',
    key: string,
) => {
    const now = Date.now();
    const availableBefore = now - OTP_RESEND_DELAY_SECONDS * 1000;
    const keyHash = await digest(key);
    const result = await database
        .prepare(
            `INSERT INTO ${table} (key_hash, sent_at)
             VALUES (?, ?)
             ON CONFLICT (key_hash) DO UPDATE SET sent_at = excluded.sent_at
             WHERE ${table}.sent_at <= ?
             RETURNING key_hash`,
        )
        .bind(keyHash, now, availableBefore)
        .all<{ key_hash: string }>();

    if (result.results.length === 0) {
        throw new OtpRequestError(
            'OTP_RESEND_DELAY',
            429,
            '请等待 60 秒后重新发送验证码。',
        );
    }
};

const sendOtpEmail = async (
    environment: AuthBindings,
    email: string,
    otp: string,
) => {
    const emailContent = renderOtpEmail(otp);
    try {
        await sendEmail(environment, email, emailContent);
    } catch (error) {
        console.error('Resend OTP delivery failed', {
            status: error instanceof EmailDeliveryError ? error.status : 0,
            providerCode:
                error instanceof EmailDeliveryError ? error.providerCode : 'unknown',
        });
        throw new OtpRequestError(
            'OTP_DELIVERY_FAILED',
            503,
            '验证码暂时无法发送，请稍后重试或更换邮箱。',
        );
    }
};

const privacyOtpHash = (secret: string, userId: string, otp: string) =>
    digest(`${secret}:${userId}:${otp}`);

export const createAuth = (environment: AuthBindings): AuthRuntime => {
    const auth = betterAuth({
        appName: 'Cofounder',
        database: environment.DB,
        secret: environment.BETTER_AUTH_SECRET,
        session: {
            expiresIn: SESSION_EXPIRES_IN_SECONDS,
            updateAge: SESSION_UPDATE_AGE_SECONDS,
        },
        rateLimit: {
            enabled: true,
            storage: 'database',
        },
        advanced: {
            ipAddress: {
                ipAddressHeaders: ['cf-connecting-ip'],
            },
        },
        plugins: [
            emailOTP({
                expiresIn: OTP_EXPIRES_IN_SECONDS,
                allowedAttempts: OTP_ALLOWED_ATTEMPTS,
                storeOTP: 'hashed',
                resendStrategy: 'rotate',
                rateLimit: {
                    window: OTP_RESEND_DELAY_SECONDS,
                    max: 1,
                },
                sendVerificationOTP: ({ email, otp }) =>
                    sendOtpEmail(environment, email, otp),
            }),
        ],
    });

    const reserveOtpSend = async (email: string, ipAddress: string) => {
        const normalizedEmail = email.trim().toLowerCase();
        await reserveSend(environment.DB, 'otp_ip_limit', ipAddress);
        await reserveSend(environment.DB, 'otp_email_limit', normalizedEmail);
        return normalizedEmail;
    };

    return {
        handler: (request) => auth.handler(request),
        getSession: async (headers) => {
            const session = await auth.api.getSession({ headers });
            if (!session) return null;

            return {
                user: {
                    id: session.user.id,
                    name: session.user.name,
                    email: session.user.email,
                },
            };
        },
        sendSignInOtp: async (email, ipAddress) => {
            const normalizedEmail = await reserveOtpSend(email, ipAddress);
            const otp = await auth.api.createVerificationOTP({
                body: { email: normalizedEmail, type: 'sign-in' },
            });
            await sendOtpEmail(environment, normalizedEmail, otp);
        },
        sendPrivacyOtp: async (userId, email, ipAddress) => {
            const normalizedEmail = await reserveOtpSend(email, ipAddress);
            const random = crypto.getRandomValues(new Uint32Array(1))[0];
            const otp = String(random % 1_000_000).padStart(6, '0');
            await sendOtpEmail(environment, normalizedEmail, otp);
            const now = Date.now();
            await environment.DB.prepare(
                `INSERT INTO privacy_action_authorization
                    (user_id, otp_hash, expires_at, attempts_remaining,
                     verified_at, consumed_at, sent_at)
                 VALUES (?, ?, ?, ?, NULL, NULL, ?)
                 ON CONFLICT (user_id) DO UPDATE SET
                    otp_hash = excluded.otp_hash,
                    expires_at = excluded.expires_at,
                    attempts_remaining = excluded.attempts_remaining,
                    verified_at = NULL,
                    consumed_at = NULL,
                    sent_at = excluded.sent_at`,
            )
                .bind(
                    userId,
                    await privacyOtpHash(environment.BETTER_AUTH_SECRET, userId, otp),
                    now + OTP_EXPIRES_IN_SECONDS * 1000,
                    OTP_ALLOWED_ATTEMPTS,
                    now,
                )
                .run();
        },
        verifyPrivacyOtp: async (userId, otp) => {
            if (!/^\d{6}$/.test(otp)) return false;
            const now = Date.now();
            const expectedHash = await privacyOtpHash(
                environment.BETTER_AUTH_SECRET,
                userId,
                otp,
            );
            const verified = await environment.DB.prepare(
                `UPDATE privacy_action_authorization
                 SET verified_at = ?
                 WHERE user_id = ? AND otp_hash = ? AND expires_at > ?
                   AND attempts_remaining > 0 AND consumed_at IS NULL
                 RETURNING user_id`,
            )
                .bind(now, userId, expectedHash, now)
                .all<{ user_id: string }>();
            if (verified.results.length === 1) return true;
            await environment.DB.prepare(
                `UPDATE privacy_action_authorization
                 SET attempts_remaining = MAX(0, attempts_remaining - 1)
                 WHERE user_id = ? AND expires_at > ? AND verified_at IS NULL`,
            )
                .bind(userId, now)
                .run();
            return false;
        },
        consumePrivacyAuthorization: async (userId) => {
            const now = Date.now();
            const consumed = await environment.DB.prepare(
                `UPDATE privacy_action_authorization
                 SET consumed_at = ?
                 WHERE user_id = ? AND verified_at IS NOT NULL
                   AND verified_at >= ? AND consumed_at IS NULL
                 RETURNING user_id`,
            )
                .bind(now, userId, now - 5 * 60 * 1000)
                .all<{ user_id: string }>();
            return consumed.results.length === 1;
        },
    };
};
