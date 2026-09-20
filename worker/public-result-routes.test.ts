import { describe, expect, it } from 'bun:test';
import { CURRENT_CONSENTS } from './account';
import { createApp, type AppServices, type Bindings } from './app';
import type {
    PublicResult,
    PublicResultRepository,
} from './public-result-repository';

const consents = Object.entries(CURRENT_CONSENTS).map(([type, version]) => ({
    type,
    version,
})) as any;

const publicResult: PublicResult = {
    status: 'published',
    names: { creator: '发起人', partner: 'Cofounder' },
    archetype: {
        title: '望远镜与工具箱',
        englishTitle: 'Vision × Reality',
        explanation: '一人看远方，一人铺道路。',
    },
    teamQuote: '先看见未来，再把今天做完。',
    safeTraits: ['方向感强', '落地有序', '互相校准'],
    date: '2026-09-20',
    versions: {
        questionSet: 'questions-v1',
        rules: 'rules-v1',
        content: 'content-v1',
    },
    cta: '敢不敢拉你的 Cofounder 测一下？',
};

const bindings = (): Bindings =>
    ({
        ASSETS: {
            fetch: async () =>
                new Response(
                    '<!doctype html><html><head><title>Diagnostics</title></head><body><div id="diagnostics"></div></body></html>',
                    { headers: { 'content-type': 'text/html' } },
                ),
        },
        MEDIA: { get: async () => null },
    }) as Bindings;

const harness = () => {
    let currentUser = { id: 'creator', name: 'Penn', email: 'penn@example.com' };
    let activeHash: string | null = null;
    const knownHashes = new Set<string>();
    const permissions = new Map<string, boolean>();
    let published = false;
    let publishCalls = 0;

    const view = (): PublicResult => ({
        ...publicResult,
        names: {
            creator: permissions.get('creator') ? 'Penn' : '发起人',
            partner: permissions.get('partner') ? 'Jason' : 'Cofounder',
        },
    });
    const repository: PublicResultRepository = {
        async publish(input) {
            publishCalls += 1;
            activeHash = input.slugHash;
            knownHashes.add(input.slugHash);
            permissions.set(input.userId, input.showMyName);
            published = true;
            return 'published';
        },
        async setNamePermission(input) {
            if (!['creator', 'partner'].includes(input.userId)) return false;
            permissions.set(input.userId, input.permitted);
            return true;
        },
        async unpublish(_pairId, userId) {
            if (!['creator', 'partner'].includes(userId) || !published) return false;
            published = false;
            return true;
        },
        async getPairState(_pairId, userId) {
            return ['creator', 'partner'].includes(userId)
                ? {
                      published,
                      myNamePublic: permissions.get(userId) || false,
                  }
                : null;
        },
        async findBySlugHash(hash) {
            if (!knownHashes.has(hash)) return null;
            return published && hash === activeHash
                ? { status: 'published', result: view() }
                : { status: 'unavailable' };
        },
    };
    let nextId = 0;
    const services: AppServices = {
        auth: () => ({
            handler: async () => new Response('auth'),
            sendSignInOtp: async () => undefined,
            getSession: async () => ({ user: currentUser }),
        }),
        accounts: () => ({
            getConsents: async () => consents,
            completeRegistration: async () => undefined,
            renewConsents: async () => undefined,
        }),
        pairs: () => ({}) as any,
        publicResults: () => repository,
        id: () => `${++nextId}`.padStart(32, 'a'),
        now: () => new Date('2026-09-20T12:00:00.000Z'),
    };
    const app = createApp(services);

    return {
        loginAs(id: 'creator' | 'partner' | 'outsider') {
            currentUser = {
                id,
                name: id === 'partner' ? 'Jason' : id === 'creator' ? 'Penn' : 'Ada',
                email: `${id}@example.com`,
            };
        },
        publishCalls: () => publishCalls,
        request: (path: string, init?: RequestInit) =>
            app.request(path, init, bindings()),
    };
};

const json = (method: string, body?: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
});

describe('privacy-safe public results', () => {
    it('does not create a public page until a Participant explicitly publishes', async () => {
        const test = harness();
        const state = await (
            await test.request('/api/pairs/pair-1/public-result')
        ).json();
        expect(state).toEqual({ published: false, myNamePublic: false });
        expect(test.publishCalls()).toBe(0);
    });

    it('returns a high-entropy path while the repository receives only its hash', async () => {
        const test = harness();
        const response = await test.request(
            '/api/pairs/pair-1/public-result',
            json('POST', { showMyName: true }),
        );
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body.publicPath).toMatch(/^\/r\/[a-zA-Z0-9]{64}$/);
        expect(body.result.names).toEqual({
            creator: 'Penn',
            partner: 'Cofounder',
        });
        const publicView = await (
            await test.request(`/api/public-results/${body.publicPath.slice(3)}`)
        ).json();
        expect(publicView).toEqual(body.result);
        expect(JSON.stringify(publicView)).not.toMatch(
            /dimension|mirror|privatePattern|conflictFlag|sensitive|answer/i,
        );
    });

    it('keeps each name anonymous until that Participant independently permits it', async () => {
        const test = harness();
        const created = await (
            await test.request(
                '/api/pairs/pair-1/public-result',
                json('POST', { showMyName: true }),
            )
        ).json();
        const slug = created.publicPath.slice(3);

        test.loginAs('partner');
        await test.request(
            '/api/pairs/pair-1/public-name',
            json('PUT', { permitted: true }),
        );
        const updated = await (
            await test.request(`/api/public-results/${slug}`)
        ).json();
        expect(updated.names).toEqual({ creator: 'Penn', partner: 'Jason' });
    });

    it('lets either Participant unpublish and leaves non-identifying metadata', async () => {
        const test = harness();
        const created = await (
            await test.request(
                '/api/pairs/pair-1/public-result',
                json('POST', { showMyName: true }),
            )
        ).json();
        const slug = created.publicPath.slice(3);
        test.loginAs('partner');

        expect(
            (
                await test.request(
                    '/api/pairs/pair-1/public-result',
                    json('DELETE'),
                )
            ).status,
        ).toBe(200);
        expect((await test.request(`/api/public-results/${slug}`)).status).toBe(404);
        const tombstone = await test.request(`/r/${slug}`);
        const html = await tombstone.text();
        expect(tombstone.headers.get('x-robots-tag')).toBe('noindex, nofollow');
        expect(html).toContain('Cofounder｜结果不可用');
        expect(html).not.toContain('Penn');
        expect(html).not.toContain('Jason');
    });
});
