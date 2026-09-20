import { describe, expect, it } from 'bun:test';
import { createApp, type AppServices, type Bindings } from './app';
import { CURRENT_CONSENTS, type ConsentRecord } from './account';
import { OtpRequestError } from './auth';
import type { PairRepository } from './pair-repository';

const createBindings = (): Bindings =>
    ({
        ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
        MEDIA: { get: async () => null },
    }) as Bindings;

const createServices = (options?: {
    signedIn?: boolean;
    consents?: ConsentRecord[];
}) => {
    const writes: Array<{ userId: string; name: string; acceptedAt: string }> = [];
    const pairs = {} as PairRepository;
    const services: AppServices = {
        auth: () => ({
            handler: async () => new Response('auth handler'),
            sendSignInOtp: async () => undefined,
            getSession: async () =>
                options?.signedIn === false
                    ? null
                    : {
                          user: {
                              id: 'account-1',
                              name: 'Pending Cofounder',
                              email: 'founder@example.com',
                          },
                      },
        }),
        accounts: () => ({
            getConsents: async () => options?.consents ?? [],
            completeRegistration: async (record) => writes.push(record),
            renewConsents: async () => undefined,
        }),
        pairs: () => pairs,
        id: () => 'pair-1',
        now: () => new Date('2026-09-20T12:00:00.000Z'),
    };

    return { services, writes };
};

describe('Account registration routes', () => {
    it('returns a recoverable OTP delivery error', async () => {
        const { services } = createServices();
        services.auth = () => ({
            handler: async () => new Response('auth handler'),
            getSession: async () => null,
            sendSignInOtp: async () => {
                throw new OtpRequestError(
                    'OTP_DELIVERY_FAILED',
                    503,
                    '验证码暂时无法发送，请稍后重试或更换邮箱。',
                );
            },
        });
        const response = await createApp(services).request(
            '/api/auth/email-otp/send-verification-otp',
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'cf-connecting-ip': '203.0.113.8',
                },
                body: JSON.stringify({
                    email: 'founder@example.com',
                    type: 'sign-in',
                }),
            },
            createBindings(),
        );

        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({
            code: 'OTP_DELIVERY_FAILED',
            message: '验证码暂时无法发送，请稍后重试或更换邮箱。',
        });
    });

    it('does not persist consent before an authenticated OTP session exists', async () => {
        const { services, writes } = createServices({ signedIn: false });
        const response = await createApp(services).request(
            '/api/account/registration',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    displayName: 'Penn',
                    ageEligible: true,
                    termsPrivacy: true,
                    overseasClassifier: true,
                }),
            },
            createBindings(),
        );

        expect(response.status).toBe(401);
        expect(writes).toHaveLength(0);
    });

    it('persists a trimmed display name and all consents after verification', async () => {
        const { services, writes } = createServices();
        const response = await createApp(services).request(
            '/api/account/registration',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    displayName: '  Penn  ',
                    ageEligible: true,
                    termsPrivacy: true,
                    overseasClassifier: true,
                }),
            },
            createBindings(),
        );

        expect(response.status).toBe(200);
        expect(writes).toEqual([
            {
                userId: 'account-1',
                name: 'Penn',
                acceptedAt: '2026-09-20T12:00:00.000Z',
            },
        ]);
        expect(await response.json()).toEqual({
            displayName: 'Penn',
            consentState: 'current',
        });
    });

    it('rejects incomplete acknowledgements', async () => {
        const { services, writes } = createServices();
        const response = await createApp(services).request(
            '/api/account/registration',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    displayName: 'Penn',
                    ageEligible: true,
                    termsPrivacy: true,
                    overseasClassifier: false,
                }),
            },
            createBindings(),
        );

        expect(response.status).toBe(400);
        expect(writes).toHaveLength(0);
    });

    it('blocks Pair activity when a required consent version changes', async () => {
        const staleConsents: ConsentRecord[] = [
            { type: 'age_eligibility', version: CURRENT_CONSENTS.age_eligibility },
            { type: 'terms_privacy', version: 'privacy-v0' },
            {
                type: 'overseas_classifier',
                version: CURRENT_CONSENTS.overseas_classifier,
            },
        ];
        const { services } = createServices({ consents: staleConsents });
        const app = createApp(services);

        const pairResponse = await app.request(
            '/api/pairs',
            { method: 'POST' },
            createBindings(),
        );
        const accountResponse = await app.request(
            '/api/account',
            undefined,
            createBindings(),
        );

        expect(pairResponse.status).toBe(428);
        expect(await pairResponse.json()).toEqual({
            code: 'CONSENT_RENEWAL_REQUIRED',
        });
        expect(accountResponse.status).toBe(200);
        expect(await accountResponse.json()).toMatchObject({
            signedIn: true,
            consentState: 'renewal_required',
        });
    });
});
