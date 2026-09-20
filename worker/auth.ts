import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';

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
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            authorization: `Bearer ${environment.RESEND_API_KEY}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            from: environment.EMAIL_FROM,
            to: [email],
            subject: `${otp} — Cofounder 登录验证码`,
            html: `<p>你的 Cofounder 验证码是：</p><p style="font-size:28px"><strong>${otp}</strong></p><p>10 分钟内有效。请勿转发给任何人。</p>`,
        }),
    });

    if (!response.ok) {
        throw new OtpRequestError(
            'OTP_DELIVERY_FAILED',
            503,
            '验证码暂时无法发送，请稍后重试或更换邮箱。',
        );
    }
};

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
            const normalizedEmail = email.trim().toLowerCase();
            await reserveSend(environment.DB, 'otp_ip_limit', ipAddress);
            await reserveSend(
                environment.DB,
                'otp_email_limit',
                normalizedEmail,
            );
            const otp = await auth.api.createVerificationOTP({
                body: { email: normalizedEmail, type: 'sign-in' },
            });
            await sendOtpEmail(environment, normalizedEmail, otp);
        },
    };
};
