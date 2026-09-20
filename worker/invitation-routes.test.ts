import { describe, expect, it } from 'bun:test';
import { CURRENT_CONSENTS, type ConsentRecord } from './account';
import { createApp, type AppServices, type Bindings } from './app';
import {
    type PairRepository,
    type PairTestRecord,
    type PairTestState,
} from './pair-repository';
import type { StoredPairResult } from './report-repository';

const currentConsents = Object.entries(CURRENT_CONSENTS).map(([type, version]) => ({
    type,
    version,
})) as ConsentRecord[];

const completeProfile = {
    relationshipStages: ['side-project'],
    knownDuration: '1-3y',
    workedDuration: '3-12m',
    responsibilities: ['product'],
    companyAuthority: 'shared',
};

const completeAnswers = () =>
    Object.fromEntries([
        ...Array.from({ length: 24 }, (_, index) => [`core:Q${index + 1}`, 'A']),
        ...['Q1', 'Q4', 'Q7', 'Q13', 'Q16', 'Q22'].map((id) => [
            `mirror:${id}`,
            'A',
        ]),
        ...Array.from({ length: 4 }, (_, index) => [`red-line:R${index + 1}`, 'A']),
    ]);

type StoredTest = {
    questionSetVersion: string;
    revision: number;
    state: PairTestState;
    createdAt: string;
    updatedAt: string;
    submittedAt: string | null;
};

type StoredPair = {
    pairId: string;
    creatorId: string;
    partnerId: string | null;
    inviteHash: string | null;
    reportStatus: 'pending' | 'generating' | 'ready';
    tests: Map<string, StoredTest>;
};

const createBindings = (): Bindings =>
    ({
        ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
        MEDIA: { get: async () => null },
    }) as Bindings;

const createHarness = () => {
    const pairs = new Map<string, StoredPair>();
    let currentUser = { id: 'creator', name: 'Penn', email: 'penn@example.com' };
    let signedIn = true;
    let consents = currentConsents;
    let nextId = 1;
    const queuedReports: string[] = [];
    let reportResult: StoredPairResult | null = null;
    let reportJobPending = false;
    let enqueueFailure = false;

    const toRecord = (pair: StoredPair, userId: string): PairTestRecord => {
        const own = pair.tests.get(userId)!;
        const role = userId === pair.creatorId ? 'creator' : 'partner';
        const partner = pair.partnerId ? pair.tests.get(pair.partnerId)! : null;
        const partnerStarted = Boolean(
            partner &&
                (partner.state.profile || Object.keys(partner.state.answers).length > 0),
        );
        return {
            pairId: pair.pairId,
            userId,
            role,
            lifecycle:
                pair.reportStatus === 'ready'
                    ? 'report_ready'
                    : pair.reportStatus === 'generating'
                      ? 'report_generating'
                      : role === 'creator' && !own.submittedAt
                        ? 'creator_draft'
                        : !pair.partnerId || !partnerStarted
                          ? 'waiting_partner'
                          : partner?.submittedAt
                            ? 'pair_complete'
                            : 'partner_in_progress',
            reportStatus: pair.reportStatus,
            partnerStatus:
                role === 'creator' && pair.partnerId
                    ? partnerStarted
                        ? 'started'
                        : 'not_started'
                    : null,
            invitationStatus: pair.partnerId
                ? 'claimed'
                : !own.submittedAt
                  ? 'unavailable'
                  : pair.inviteHash
                    ? 'active'
                    : 'cancelled',
            ...own,
        };
    };

    const repository: PairRepository = {
        async create({ pairId, userId, questionSetVersion, createdAt }) {
            const pair: StoredPair = {
                pairId,
                creatorId: userId,
                partnerId: null,
                inviteHash: null,
                reportStatus: 'pending',
                tests: new Map([
                    [
                        userId,
                        {
                            questionSetVersion,
                            revision: 0,
                            state: { profile: null, answers: {} },
                            createdAt,
                            updatedAt: createdAt,
                            submittedAt: null,
                        },
                    ],
                ]),
            };
            pairs.set(pairId, pair);
            return toRecord(pair, userId);
        },
        async listForUser(userId) {
            return [...pairs.values()]
                .filter((pair) => pair.creatorId === userId || pair.partnerId === userId)
                .map((pair) => toRecord(pair, userId));
        },
        async get(pairId, userId) {
            const pair = pairs.get(pairId);
            return pair?.tests.has(userId) ? toRecord(pair, userId) : null;
        },
        async save(pairId, userId, expectedRevision, state, updatedAt) {
            const pair = pairs.get(pairId);
            const test = pair?.tests.get(userId);
            if (!pair || !test) return 'not_found';
            if (test.submittedAt) return 'sealed';
            if (test.revision !== expectedRevision) return 'conflict';
            test.state = state;
            test.revision += 1;
            test.updatedAt = updatedAt;
            return toRecord(pair, userId);
        },
        async submit(pairId, userId, expectedRevision, submittedAt, inviteHash) {
            const pair = pairs.get(pairId);
            const test = pair?.tests.get(userId);
            if (!pair || !test) return 'not_found';
            if (test.submittedAt) return 'sealed';
            if (test.revision !== expectedRevision) return 'conflict';
            test.submittedAt = submittedAt;
            test.updatedAt = submittedAt;
            test.revision += 1;
            if (userId === pair.creatorId && inviteHash) pair.inviteHash = inviteHash;
            if (
                pair.partnerId &&
                [...pair.tests.values()].every(({ submittedAt }) => submittedAt)
            ) {
                pair.reportStatus = 'generating';
                reportJobPending = true;
            }
            return toRecord(pair, userId);
        },
        async findInvitation(tokenHash) {
            const pair = [...pairs.values()].find(
                (candidate) =>
                    candidate.inviteHash === tokenHash && candidate.partnerId === null,
            );
            return pair
                ? {
                      pairId: pair.pairId,
                      creatorUserId: pair.creatorId,
                      creatorDisplayName: 'Penn',
                  }
                : null;
        },
        async claimInvitation(tokenHash, userId, claimedAt) {
            const invitation = await this.findInvitation(tokenHash);
            if (!invitation) return 'unavailable';
            if (invitation.creatorUserId === userId) return 'same_account';
            const pair = pairs.get(invitation.pairId)!;
            pair.partnerId = userId;
            pair.inviteHash = null;
            const creatorTest = pair.tests.get(pair.creatorId)!;
            pair.tests.set(userId, {
                questionSetVersion: creatorTest.questionSetVersion,
                revision: 0,
                state: { profile: null, answers: {} },
                createdAt: claimedAt,
                updatedAt: claimedAt,
                submittedAt: null,
            });
            return toRecord(pair, userId);
        },
        async resetInvitation(pairId, userId, tokenHash) {
            const pair = pairs.get(pairId);
            if (!pair?.tests.has(userId)) return 'not_found';
            if (
                pair.creatorId !== userId ||
                pair.partnerId ||
                !pair.tests.get(userId)?.submittedAt
            ) {
                return 'invitation_locked';
            }
            pair.inviteHash = tokenHash;
            return toRecord(pair, userId);
        },
        async cancelInvitation(pairId, userId) {
            const pair = pairs.get(pairId);
            if (!pair?.tests.has(userId)) return 'not_found';
            if (
                pair.creatorId !== userId ||
                pair.partnerId ||
                !pair.tests.get(userId)?.submittedAt
            ) {
                return 'invitation_locked';
            }
            pair.inviteHash = null;
            return toRecord(pair, userId);
        },
    };

    const services: AppServices = {
        auth: () => ({
            handler: async () => new Response('auth'),
            sendSignInOtp: async () => undefined,
            getSession: async () => (signedIn ? { user: currentUser } : null),
        }),
        accounts: () => ({
            getConsents: async () => consents,
            completeRegistration: async () => undefined,
            renewConsents: async () => undefined,
        }),
        pairs: () => repository,
        reports: () => ({
            getResult: async () => reportResult,
            getInput: async () => null,
            commitResult: async (result) => result,
            getPendingJobs: async (_limit, _retryBefore, pairId) =>
                reportJobPending && pairId ? [pairId] : [],
            markJobDispatched: async () => {
                reportJobPending = false;
            },
            markJobCompleted: async () => undefined,
        }),
        enqueueReport: async (_environment, message) => {
            if (enqueueFailure) throw new Error('queue unavailable');
            queuedReports.push(message.pairId);
        },
        id: () => `generated-${nextId++}`,
        now: () => new Date('2026-09-20T12:00:00.000Z'),
    };
    const app = createApp(services);
    const request = (path: string, init?: RequestInit) =>
        app.request(path, init, createBindings());
    const loginAs = (id: string, name: string) => {
        currentUser = { id, name, email: `${id}@example.com` };
    };

    return {
        loginAs,
        pairs,
        queuedReports,
        request,
        setReport(result: StoredPairResult) {
            reportResult = result;
            pairs.get(result.pairId)!.reportStatus = 'ready';
        },
        setEnqueueFailure(value: boolean) {
            enqueueFailure = value;
        },
        setSignedIn(value: boolean) {
            signedIn = value;
        },
        setConsents(value: ConsentRecord[]) {
            consents = value;
        },
    };
};

const postJson = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
});

const sealCreator = async (harness: ReturnType<typeof createHarness>) => {
    const created = await (await harness.request('/api/pairs', { method: 'POST' })).json();
    const pair = harness.pairs.get(created.pairId)!;
    const test = pair.tests.get('creator')!;
    test.state = { profile: completeProfile, answers: completeAnswers() };
    const response = await harness.request(
        `/api/pairs/${pair.pairId}/submit`,
        postJson({ revision: 0 }),
    );
    return { pair, response, body: await response.json() };
};

describe('Pair invitation lifecycle', () => {
    it('creates an opaque invitation only after the creator seals', async () => {
        const harness = createHarness();
        const created = await (await harness.request('/api/pairs', { method: 'POST' })).json();

        const earlyReset = await harness.request(
            `/api/pairs/${created.pairId}/invitation`,
            postJson({ action: 'reset' }),
        );
        expect(earlyReset.status).toBe(409);

        const sealed = await sealCreator(createHarness());
        expect(sealed.response.status).toBe(200);
        expect(sealed.body.invitation.path).toBe('/invite/generated-2');
    });

    it('previews without claiming or exposing Pair answers', async () => {
        const harness = createHarness();
        const { pair, body } = await sealCreator(harness);
        const token = body.invitation.path.split('/').pop();
        const preview = await harness.request(`/api/invitations/${token}`);

        expect(preview.status).toBe(200);
        expect(await preview.json()).toEqual({ creatorDisplayName: 'Penn' });
        expect(pair.partnerId).toBeNull();
        expect(pair.inviteHash).not.toBe(token);
    });

    it('requires explicit acceptance and a different Account to claim', async () => {
        const harness = createHarness();
        const { body } = await sealCreator(harness);
        const token = body.invitation.path.split('/').pop();

        const implicit = await harness.request(
            `/api/invitations/${token}/claim`,
            postJson({ accepted: false }),
        );
        expect(implicit.status).toBe(400);

        const selfClaim = await harness.request(
            `/api/invitations/${token}/claim`,
            postJson({ accepted: true }),
        );
        expect(selfClaim.status).toBe(409);
        expect(await selfClaim.json()).toEqual({ code: 'SELF_INVITATION' });

        harness.loginAs('partner', 'Jason');
        const claimed = await harness.request(
            `/api/invitations/${token}/claim`,
            postJson({ accepted: true }),
        );
        expect(claimed.status).toBe(200);
        expect(await claimed.json()).toMatchObject({
            role: 'partner',
            status: 'draft',
            answers: {},
        });
    });

    it('requires authentication, current consent, and a display identity', async () => {
        const harness = createHarness();
        const { body } = await sealCreator(harness);
        const token = body.invitation.path.split('/').pop();
        harness.loginAs('partner', 'Jason');

        harness.setSignedIn(false);
        const anonymous = await harness.request(
            `/api/invitations/${token}/claim`,
            postJson({ accepted: true }),
        );
        expect(anonymous.status).toBe(401);

        harness.setSignedIn(true);
        harness.setConsents([]);
        const staleConsent = await harness.request(
            `/api/invitations/${token}/claim`,
            postJson({ accepted: true }),
        );
        expect(staleConsent.status).toBe(428);

        harness.setConsents(currentConsents);
        harness.loginAs('partner', '   ');
        const missingIdentity = await harness.request(
            `/api/invitations/${token}/claim`,
            postJson({ accepted: true }),
        );
        expect(missingIdentity.status).toBe(428);
        expect(await missingIdentity.json()).toEqual({ code: 'DISPLAY_NAME_REQUIRED' });
    });

    it('reports only whether the partner started and never exposes their answers', async () => {
        const harness = createHarness();
        const { pair, body } = await sealCreator(harness);
        const token = body.invitation.path.split('/').pop();
        harness.loginAs('partner', 'Jason');
        await harness.request(
            `/api/invitations/${token}/claim`,
            postJson({ accepted: true }),
        );
        await harness.request(
            `/api/pairs/${pair.pairId}/profile`,
            {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ revision: 0, profile: completeProfile }),
            },
        );
        await harness.request(
            `/api/pairs/${pair.pairId}/answers/core/Q1`,
            {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ revision: 1, optionId: 'B' }),
            },
        );

        harness.loginAs('creator', 'Penn');
        const creatorView = await (await harness.request(`/api/pairs/${pair.pairId}/test`)).json();
        expect(creatorView.partnerStatus).toBe('started');
        expect(creatorView.lifecycle).toBe('partner_in_progress');
        expect(creatorView.answers['core:Q1']).toBe('A');
        expect(JSON.stringify(creatorView)).not.toContain('"core:Q1":"B"');

        harness.loginAs('partner', 'Jason');
        const partnerTest = pair.tests.get('partner')!;
        const partnerAnswers = completeAnswers();
        partnerAnswers['core:Q1'] = 'B';
        partnerTest.state = { profile: completeProfile, answers: partnerAnswers };
        const partnerSubmit = await harness.request(
            `/api/pairs/${pair.pairId}/submit`,
            postJson({ revision: partnerTest.revision }),
        );
        expect(partnerSubmit.status).toBe(200);

        harness.loginAs('creator', 'Penn');
        const completed = await (await harness.request(`/api/pairs/${pair.pairId}/test`)).json();
        expect(completed.lifecycle).toBe('report_generating');
        expect(JSON.stringify(completed)).not.toContain('"core:Q1":"B"');
    });

    it('enqueues completion once and gives both Participants the same report', async () => {
        const harness = createHarness();
        const { pair, body } = await sealCreator(harness);
        const token = body.invitation.path.split('/').pop();
        harness.loginAs('partner', 'Jason');
        await harness.request(
            `/api/invitations/${token}/claim`,
            postJson({ accepted: true }),
        );
        const partnerTest = pair.tests.get('partner')!;
        partnerTest.state = { profile: completeProfile, answers: completeAnswers() };

        const completed = await harness.request(
            `/api/pairs/${pair.pairId}/submit`,
            postJson({ revision: partnerTest.revision }),
        );
        expect(completed.status).toBe(200);
        expect(harness.queuedReports).toEqual([pair.pairId]);

        const duplicate = await harness.request(
            `/api/pairs/${pair.pairId}/submit`,
            postJson({ revision: partnerTest.revision + 1 }),
        );
        expect(duplicate.status).toBe(409);
        expect(harness.queuedReports).toEqual([pair.pairId]);

        harness.setReport({
            pairId: pair.pairId,
            questionSetVersion: 'cofounder-questionnaire-v1',
            rulesVersion: 'cofounder-rules-v1',
            contentVersion: 'cofounder-content-v1',
            report: { immutable: 'same-for-both' },
            createdAt: '2026-09-20T12:02:00.000Z',
        } as unknown as StoredPairResult);

        const partnerReport = await (
            await harness.request(`/api/pairs/${pair.pairId}/report`)
        ).json();
        harness.loginAs('creator', 'Penn');
        const creatorReport = await (
            await harness.request(`/api/pairs/${pair.pairId}/report`)
        ).json();
        expect(creatorReport.report).toEqual(partnerReport.report);

        harness.loginAs('outsider', 'Ada');
        expect(
            (await harness.request(`/api/pairs/${pair.pairId}/report`)).status,
        ).toBe(404);
    });

    it('keeps a failed Queue send in the outbox for a safe retry', async () => {
        const harness = createHarness();
        const { pair, body } = await sealCreator(harness);
        const token = body.invitation.path.split('/').pop();
        harness.loginAs('partner', 'Jason');
        await harness.request(
            `/api/invitations/${token}/claim`,
            postJson({ accepted: true }),
        );
        const partnerTest = pair.tests.get('partner')!;
        partnerTest.state = { profile: completeProfile, answers: completeAnswers() };
        harness.setEnqueueFailure(true);

        const completed = await harness.request(
            `/api/pairs/${pair.pairId}/submit`,
            postJson({ revision: partnerTest.revision }),
        );
        expect(completed.status).toBe(200);
        expect((await completed.json()).reportStatus).toBe('generating');
        expect(harness.queuedReports).toEqual([]);

        harness.setEnqueueFailure(false);
        const retry = await harness.request(
            `/api/pairs/${pair.pairId}/submit`,
            postJson({ revision: partnerTest.revision + 1 }),
        );
        expect(retry.status).toBe(409);
        expect(harness.queuedReports).toEqual([pair.pairId]);
    });

    it('invalidates reset and cancelled links and locks replacement after claim', async () => {
        const harness = createHarness();
        const { pair, body } = await sealCreator(harness);
        const firstToken = body.invitation.path.split('/').pop();
        const reset = await harness.request(
            `/api/pairs/${pair.pairId}/invitation`,
            postJson({ action: 'reset' }),
        );
        const resetBody = await reset.json();
        const secondToken = resetBody.invitation.path.split('/').pop();

        expect((await harness.request(`/api/invitations/${firstToken}`)).status).toBe(404);
        expect((await harness.request(`/api/invitations/${secondToken}`)).status).toBe(200);

        const cancelled = await harness.request(
            `/api/pairs/${pair.pairId}/invitation`,
            postJson({ action: 'cancel' }),
        );
        expect(cancelled.status).toBe(200);
        expect((await harness.request(`/api/invitations/${secondToken}`)).status).toBe(404);

        const recreated = await harness.request(
            `/api/pairs/${pair.pairId}/invitation`,
            postJson({ action: 'reset' }),
        );
        const thirdToken = (await recreated.json()).invitation.path.split('/').pop();
        harness.loginAs('partner', 'Jason');
        await harness.request(
            `/api/invitations/${thirdToken}/claim`,
            postJson({ accepted: true }),
        );
        harness.loginAs('creator', 'Penn');
        const locked = await harness.request(
            `/api/pairs/${pair.pairId}/invitation`,
            postJson({ action: 'reset' }),
        );
        expect(locked.status).toBe(409);
    });
});
