import { describe, expect, it } from 'bun:test';
import { createApp, type AppServices, type Bindings } from './app';
import type { PairRepository } from './pair-repository';
import type { PrivacyExport, PrivacyRepository } from './privacy-repository';

const bindings = () =>
    ({
        ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
        MEDIA: { get: async () => null },
    }) as Bindings;

const exported: PrivacyExport = {
    exportedAt: '2026-09-20T12:00:00.000Z',
    account: {
        id: 'creator',
        displayName: 'Penn',
        email: 'penn@example.com',
        createdAt: '2026-01-01',
        updatedAt: '2026-09-20',
    },
    consents: [{ type: 'terms_privacy', version: 'old', consentedAt: '2026-01-01' }],
    ownPairData: [
        {
            pairId: 'pair-1',
            role: 'creator',
            lifecycle: 'report_ready',
            questionSetVersion: 'q1',
            profile: null,
            answers: { 'core:Q1': 'A' },
            submittedAt: '2026-09-20',
            updatedAt: '2026-09-20',
        },
    ],
    sharedReports: [{ pairId: 'pair-1', report: { portrait: 'shared' }, createdAt: '2026-09-20' }],
};

const harness = () => {
    let authorized = false;
    const sent: string[] = [];
    const withdrawals: string[] = [];
    const deletions: string[] = [];
    const privacy: PrivacyRepository = {
        exportData: async () => exported,
        withdrawFromPair: async (pairId) => {
            withdrawals.push(pairId);
            return pairId === 'pair-1';
        },
        deleteAccount: async ({ userId }) => {
            deletions.push(userId);
            return true;
        },
    };
    const services: AppServices = {
        auth: () => ({
            handler: async () => new Response('auth'),
            getSession: async () => ({
                user: { id: 'creator', name: 'Penn', email: 'penn@example.com' },
            }),
            sendSignInOtp: async () => undefined,
            sendPrivacyOtp: async (_userId, email) => sent.push(email),
            verifyPrivacyOtp: async (_userId, otp) => {
                authorized = otp === '123456';
                return authorized;
            },
            consumePrivacyAuthorization: async () => {
                const result = authorized;
                authorized = false;
                return result;
            },
        }),
        accounts: () => ({
            getConsents: async () => [],
            completeRegistration: async () => undefined,
            renewConsents: async () => undefined,
        }),
        pairs: () => ({}) as PairRepository,
        privacy: () => privacy,
        id: () => 'tombstone-id',
        now: () => new Date('2026-09-20T12:00:00.000Z'),
    };
    return { app: createApp(services), sent, withdrawals, deletions };
};

const authorize = async (app: ReturnType<typeof createApp>) => {
    const response = await app.request(
        '/api/privacy/authorize',
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ otp: '123456' }),
        },
        bindings(),
    );
    expect(response.status).toBe(200);
};

describe('Privacy & Data routes', () => {
    it('exports only the Account holder data and shared report despite stale consent', async () => {
        const { app } = harness();
        const response = await app.request('/api/privacy/export', undefined, bindings());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toContain('.json');
        expect(body).toEqual(exported);
        expect(JSON.stringify(body)).not.toContain('counterpartAnswers');
    });

    it('requires a fresh one-use OTP for each destructive action', async () => {
        const { app, sent, withdrawals, deletions } = harness();
        const challenge = await app.request(
            '/api/privacy/challenge',
            { method: 'POST' },
            bindings(),
        );
        expect(challenge.status).toBe(200);
        expect(sent).toEqual(['penn@example.com']);

        const denied = await app.request(
            '/api/privacy/pairs/pair-1',
            { method: 'DELETE' },
            bindings(),
        );
        expect(denied.status).toBe(428);

        await authorize(app);
        const withdrawn = await app.request(
            '/api/privacy/pairs/pair-1',
            { method: 'DELETE' },
            bindings(),
        );
        expect(withdrawn.status).toBe(200);
        expect(withdrawals).toEqual(['pair-1']);

        const reused = await app.request(
            '/api/privacy/account',
            { method: 'DELETE' },
            bindings(),
        );
        expect(reused.status).toBe(428);
        expect(deletions).toHaveLength(0);

        await authorize(app);
        const deleted = await app.request(
            '/api/privacy/account',
            { method: 'DELETE' },
            bindings(),
        );
        expect(deleted.status).toBe(200);
        expect(deletions).toEqual(['creator']);
    });

    it('rejects malformed verification codes', async () => {
        const { app } = harness();
        const response = await app.request(
            '/api/privacy/authorize',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ otp: 'not-a-code' }),
            },
            bindings(),
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ code: 'INVALID_OTP' });
    });
});
