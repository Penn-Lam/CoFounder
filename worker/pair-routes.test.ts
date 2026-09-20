import { describe, expect, it } from 'bun:test';
import { CURRENT_CONSENTS, type ConsentRecord } from './account';
import { createApp, type AppServices, type Bindings } from './app';
import { type PairRepository, type PairTestRecord } from './pair-repository';

const currentConsents = Object.entries(CURRENT_CONSENTS).map(([type, version]) => ({
    type,
    version,
})) as ConsentRecord[];

const createBindings = (): Bindings =>
    ({
        ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
        MEDIA: { get: async () => null },
    }) as Bindings;

const createHarness = () => {
    const pairs = new Map<string, PairTestRecord>();
    const repository: PairRepository = {
        async create({ pairId, userId, questionSetVersion, createdAt }) {
            const active = [...pairs.values()].filter(
                (pair) => pair.userId === userId && pair.submittedAt === null,
            );
            if (active.length >= 3) return null;
            const pair: PairTestRecord = {
                pairId,
                userId,
                role: 'creator',
                lifecycle: 'creator_draft',
                partnerStatus: null,
                invitationStatus: 'unavailable',
                questionSetVersion,
                revision: 0,
                state: { profile: null, answers: {} },
                createdAt,
                submittedAt: null,
            };
            pairs.set(pairId, pair);
            return pair;
        },
        async get(pairId, userId) {
            const pair = pairs.get(pairId);
            return pair?.userId === userId ? pair : null;
        },
        async listForUser(userId) {
            return [...pairs.values()].filter(
                (pair) => pair.userId === userId,
            );
        },
        async save(pairId, userId, expectedRevision, state, updatedAt) {
            const pair = pairs.get(pairId);
            if (!pair || pair.userId !== userId) return 'not_found';
            if (pair.submittedAt) return 'sealed';
            if (pair.revision !== expectedRevision) return 'conflict';
            pair.state = state;
            pair.revision += 1;
            pair.updatedAt = updatedAt;
            return pair;
        },
        async submit(pairId, userId, expectedRevision, submittedAt, invitationTokenHash) {
            const pair = pairs.get(pairId);
            if (!pair || pair.userId !== userId) return 'not_found';
            if (pair.submittedAt) return 'sealed';
            if (pair.revision !== expectedRevision) return 'conflict';
            pair.revision += 1;
            pair.submittedAt = submittedAt;
            pair.lifecycle = 'waiting_partner';
            pair.invitationStatus = invitationTokenHash ? 'active' : 'cancelled';
            return pair;
        },
        async findInvitation() {
            return null;
        },
        async claimInvitation() {
            return 'unavailable';
        },
        async resetInvitation() {
            return 'invitation_locked';
        },
        async cancelInvitation() {
            return 'invitation_locked';
        },
    };
    let nextId = 1;
    const services: AppServices = {
        auth: () => ({
            handler: async () => new Response('auth'),
            sendSignInOtp: async () => undefined,
            getSession: async () => ({
                user: {
                    id: 'account-1',
                    name: 'Penn',
                    email: 'penn@example.com',
                },
            }),
        }),
        accounts: () => ({
            getConsents: async () => currentConsents,
            completeRegistration: async () => undefined,
            renewConsents: async () => undefined,
        }),
        pairs: () => repository,
        id: () => `pair-${nextId++}`,
        now: () => new Date('2026-09-20T12:00:00.000Z'),
    };
    const app = createApp(services);
    const request = (path: string, init?: RequestInit) =>
        app.request(path, init, createBindings());

    return { pairs, request };
};

const putJson = (body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
});

const completeProfile = {
    relationshipStages: ['side-project', 'product'],
    knownDuration: '1-3y',
    workedDuration: '3-12m',
    responsibilities: ['product', 'strategy'],
    companyAuthority: 'shared',
};

describe('Pair Test routes', () => {
    it('serves the versioned 24 + 6 + 4 question contract', async () => {
        const { request } = createHarness();
        const response = await request('/api/questionnaire/current');
        const questionnaire = await response.json();

        expect(response.status).toBe(200);
        expect(questionnaire.questions).toHaveLength(24);
        expect(questionnaire.mirrorQuestionIds).toHaveLength(6);
        expect(questionnaire.redLineQuestions).toHaveLength(4);
    });

    it('allows at most three active incomplete Pairs', async () => {
        const { request } = createHarness();

        for (let count = 0; count < 3; count += 1) {
            const response = await request('/api/pairs', { method: 'POST' });
            expect(response.status).toBe(201);
        }

        const response = await request('/api/pairs', { method: 'POST' });
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ code: 'ACTIVE_PAIR_LIMIT' });
    });

    it('saves a valid profile and rejects a stale-device revision', async () => {
        const { request } = createHarness();
        const created = await (await request('/api/pairs', { method: 'POST' })).json();
        const pairId = created.pairId as string;

        const saved = await request(
            `/api/pairs/${pairId}/profile`,
            putJson({ revision: 0, profile: completeProfile }),
        );
        expect(saved.status).toBe(200);
        expect(await saved.json()).toMatchObject({ revision: 1, profile: completeProfile });

        const stale = await request(
            `/api/pairs/${pairId}/profile`,
            putJson({ revision: 0, profile: completeProfile }),
        );
        expect(stale.status).toBe(409);
        expect(await stale.json()).toEqual({ code: 'REVISION_CONFLICT' });
    });

    it('validates answer options and saves each section independently', async () => {
        const { request } = createHarness();
        const created = await (await request('/api/pairs', { method: 'POST' })).json();
        const pairId = created.pairId as string;

        const invalid = await request(
            `/api/pairs/${pairId}/answers/core/Q1`,
            putJson({ revision: 0, optionId: 'Z' }),
        );
        expect(invalid.status).toBe(400);
        expect(await invalid.json()).toEqual({ code: 'INVALID_ANSWER' });

        const core = await request(
            `/api/pairs/${pairId}/answers/core/Q1`,
            putJson({ revision: 0, optionId: 'D' }),
        );
        expect(core.status).toBe(200);
        const mirror = await request(
            `/api/pairs/${pairId}/answers/mirror/Q1`,
            putJson({ revision: 1, optionId: 'C' }),
        );
        expect(mirror.status).toBe(200);

        const state = await (await request(`/api/pairs/${pairId}/test`)).json();
        expect(state.answers).toEqual({ 'core:Q1': 'D', 'mirror:Q1': 'C' });
        expect(state.revision).toBe(2);
    });

    it('never validates an old draft against a different question set', async () => {
        const { pairs, request } = createHarness();
        const created = await (await request('/api/pairs', { method: 'POST' })).json();
        pairs.get(created.pairId)!.questionSetVersion = 'retired-question-set';

        const response = await request(
            `/api/pairs/${created.pairId}/answers/core/Q1`,
            putJson({ revision: 0, optionId: 'A' }),
        );

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ code: 'QUESTION_SET_NOT_FOUND' });
    });

    it('requires all 34 answers before atomically sealing the Pair Test', async () => {
        const { pairs, request } = createHarness();
        const created = await (await request('/api/pairs', { method: 'POST' })).json();
        const pairId = created.pairId as string;
        const pair = pairs.get(pairId)!;

        pair.state.profile = completeProfile;
        pair.state.answers = Object.fromEntries([
            ...Array.from({ length: 24 }, (_, index) => [`core:Q${index + 1}`, 'A']),
            ...['Q1', 'Q4', 'Q7', 'Q13', 'Q16', 'Q22'].map((id) => [
                `mirror:${id}`,
                'A',
            ]),
            ...Array.from({ length: 4 }, (_, index) => [`red-line:R${index + 1}`, 'A']),
        ]);

        const submitted = await request(`/api/pairs/${pairId}/submit`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ revision: 0 }),
        });
        expect(submitted.status).toBe(200);
        expect(await submitted.json()).toMatchObject({ status: 'submitted', revision: 1 });

        const edit = await request(
            `/api/pairs/${pairId}/answers/core/Q1`,
            putJson({ revision: 1, optionId: 'B' }),
        );
        expect(edit.status).toBe(409);
        expect(await edit.json()).toEqual({ code: 'PAIR_TEST_SEALED' });
    });

    it('reports missing profile and answer IDs without partially sealing', async () => {
        const { request } = createHarness();
        const created = await (await request('/api/pairs', { method: 'POST' })).json();

        const response = await request(`/api/pairs/${created.pairId}/submit`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ revision: 0 }),
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.code).toBe('PAIR_TEST_INCOMPLETE');
        expect(body.missingProfile).toBe(true);
        expect(body.missingAnswers).toHaveLength(34);
    });
});
