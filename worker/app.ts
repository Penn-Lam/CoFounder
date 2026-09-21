import { Hono, type MiddlewareHandler } from 'hono';
import {
    getConsentState,
    hasRequiredAcknowledgements,
    validateDisplayName,
} from './account';
import {
    createAccountRepository,
    type AccountRepository,
} from './account-repository';
import {
    createAuth,
    OtpRequestError,
    OTP_EXPIRES_IN_SECONDS,
    type AuthBindings,
    type AuthRuntime,
} from './auth';
import {
    createPairRepository,
    type PairRepository,
    type PairTestRecord,
    type PairWriteResult,
} from './pair-repository';
import {
    getQuestionnaireVersion,
    publicQuestionnaire,
    QUESTION_SET_VERSION,
    validateProfile,
} from './questionnaire';
import { contentLibraryV1 } from './content-library';
import { createJevClassifier } from './jev-classifier';
import { processPairReport } from './report-processor';
import {
    createReportRepository,
    type ReportRepository,
} from './report-repository';
import {
    createPublicResultRepository,
    type PublicResultRepository,
} from './public-result-repository';
import type { PublicResult } from './public-result-contract';
import {
    createPrivacyRepository,
    type PrivacyRepository,
} from './privacy-repository';
import { runDefaultPairLifecycle } from './pair-lifecycle';
import {
    createProductAnalyticsRepository,
    type ProductAnalyticsRepository,
    type ProductEvent,
} from './product-analytics';
import {
    createAbuseRepository,
    evaluateAbuse,
    verifyTurnstile,
    type AbusePolicy,
    type AbuseRepository,
} from './abuse-controls';

export type GenerateReportMessage = {
    type: 'generate-report';
    pairId: string;
};

type AssetBinding = {
    fetch(input: Request | URL | string): Promise<Response>;
};

type MediaObject = {
    body: BodyInit | null;
    httpEtag: string;
    writeHttpMetadata(headers: Headers): void;
};

type MediaBinding = {
    get(key: string): Promise<MediaObject | null>;
};

export type Bindings = {
    ASSETS: AssetBinding;
    MEDIA: MediaBinding;
    REPORT_QUEUE: Queue<GenerateReportMessage>;
    JEV_API_KEY?: string;
    OPENROUTER_API_KEY?: string;
    JEV_CONFIDENCE_THRESHOLD?: string;
    TURNSTILE_SECRET?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_HOSTNAMES?: string;
    WEB_ANALYTICS_TOKEN?: string;
} & AuthBindings;

export type AppServices = {
    auth(environment: Bindings): AuthRuntime;
    accounts(environment: Bindings): AccountRepository;
    pairs(environment: Bindings): PairRepository;
    reports?(environment: Bindings): ReportRepository;
    publicResults?(environment: Bindings): PublicResultRepository;
    privacy?(environment: Bindings): PrivacyRepository;
    analytics?(environment: Bindings): ProductAnalyticsRepository;
    abuse?(environment: Bindings): AbuseRepository;
    verifyTurnstile?: typeof verifyTurnstile;
    enqueueReport?(
        environment: Bindings,
        message: GenerateReportMessage,
    ): Promise<void>;
    id(): string;
    now(): Date;
};

const defaultServices: AppServices = {
    auth: createAuth,
    accounts: (environment) => createAccountRepository(environment.DB),
    pairs: (environment) => createPairRepository(environment.DB),
    reports: (environment) => createReportRepository(environment.DB),
    publicResults: (environment) => createPublicResultRepository(environment.DB),
    privacy: (environment) => createPrivacyRepository(environment.DB),
    analytics: (environment) => createProductAnalyticsRepository(environment.DB),
    abuse: (environment) => createAbuseRepository(environment.DB),
    verifyTurnstile,
    enqueueReport: async (environment, message) => {
        await environment.REPORT_QUEUE.send(message);
    },
    id: () => crypto.randomUUID(),
    now: () => new Date(),
};

export const OTP_ABUSE_POLICIES: AbusePolicy[] = [
    { scope: 'otp_email', windowSeconds: 3600, challengeAfter: 3, blockAfter: 10, action: 'otp' },
    { scope: 'otp_ip', windowSeconds: 3600, challengeAfter: 5, blockAfter: 20, action: 'otp' },
];

export const PAIR_ABUSE_POLICIES: AbusePolicy[] = [
    { scope: 'pair_user', windowSeconds: 86400, challengeAfter: 3, blockAfter: 10, action: 'pair_create' },
    { scope: 'pair_ip', windowSeconds: 86400, challengeAfter: 5, blockAfter: 20, action: 'pair_create' },
];

export const PUBLIC_ABUSE_POLICIES: AbusePolicy[] = [
    { scope: 'public_user', windowSeconds: 3600, challengeAfter: 3, blockAfter: 10, action: 'public_generate' },
];

const ACCOUNT_ABUSE_POLICY: AbusePolicy = {
    scope: 'account_ip',
    windowSeconds: 86400,
    challengeAfter: 10,
    blockAfter: 10,
    action: 'otp',
};

const confidenceThreshold = (value?: string) => {
    if (value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
        ? parsed
        : undefined;
};

type CurrentAccount = {
    session: NonNullable<Awaited<ReturnType<AuthRuntime['getSession']>>>;
    consentState: ReturnType<typeof getConsentState>;
};

type AppEnvironment = {
    Bindings: Bindings;
    Variables: { account: CurrentAccount };
};

const addWebAnalytics = async (response: Response, token?: string) => {
    if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) return response;
    const html = await response.text();
    const beacon = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token })}'></script>`;
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('etag');
    return new Response(html.replace('</body>', `${beacon}</body>`), {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
};

const fetchShell = async (assets: AssetBinding, path: string, analyticsToken?: string) =>
    addWebAnalytics(
        await assets.fetch(new Request(`https://assets.local${path}`)),
        analyticsToken,
    );

const hashInvitationToken = async (token: string) => {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(token),
    );
    return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');
};

const escapeHtml = (value: string) =>
    value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character]!,
    );

const publicMetadata = (result: PublicResult | null, withdrawn: boolean) => {
    const title = result
        ? `${result.names.creator} × ${result.names.partner}｜${result.archetype.title}`
        : withdrawn
          ? 'Cofounder｜Withdrawn Result'
          : 'Cofounder｜结果不可用';
    const description = result
        ? `${result.archetype.englishTitle}。${result.teamQuote}`
        : withdrawn
          ? '这份 Cofounder 公开结果已由参与者撤回。'
          : '这份 Cofounder 公开结果不可用。';
    return [
        '<meta name="robots" content="noindex,nofollow" />',
        `<meta property="og:title" content="${escapeHtml(title)}" />`,
        `<meta property="og:description" content="${escapeHtml(description)}" />`,
        '<meta property="og:type" content="website" />',
        `<meta name="twitter:card" content="summary" />`,
        `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
        `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
        `<title>${escapeHtml(title)}</title>`,
    ].join('');
};

const publicResultShell = async (
    assets: AssetBinding,
    result: PublicResult | null,
    withdrawn = false,
    analyticsToken?: string,
) => {
    const shell = await fetchShell(assets, '/desktop/index.html', analyticsToken);
    const html = await shell.text();
    return new Response(
        html
            .replace(/<title>.*?<\/title>/, '')
            .replace('</head>', `${publicMetadata(result, withdrawn)}</head>`),
        {
            status: shell.status,
            headers: {
                'content-type': 'text/html; charset=UTF-8',
                'x-robots-tag': 'noindex, nofollow',
            },
        },
    );
};

const dispatchReportJobs = async (
    repository: ReportRepository,
    enqueue: (message: GenerateReportMessage) => Promise<void>,
    dispatchedAt: string,
    pairId?: string,
) => {
    const retryBefore = new Date(
        new Date(dispatchedAt).getTime() - 5 * 60 * 1000,
    ).toISOString();
    const pending = await repository.getPendingJobs(
        pairId ? 1 : 25,
        retryBefore,
        pairId,
    );
    for (const pendingPairId of pending) {
        await enqueue({ type: 'generate-report', pairId: pendingPairId });
        await repository.markJobDispatched(pendingPairId, dispatchedAt);
    }
};

export const createApp = (services: AppServices = defaultServices) => {
    const app = new Hono<AppEnvironment>();

    const recordEvent = async (environment: Bindings, event: ProductEvent) => {
        if (!services.analytics) return;
        try {
            await services.analytics(environment).record(event);
        } catch {
            console.error('Product analytics event could not be recorded', {
                pairId: event.pairId,
                eventType: event.type,
            });
        }
    };

    const guardAbuse = async (
        context: Parameters<MiddlewareHandler<AppEnvironment>>[0],
        policies: AbusePolicy[],
        keys: Parameters<typeof evaluateAbuse>[2],
        token: unknown,
    ) => {
        if (!services.abuse) return null;
        const decision = await evaluateAbuse(
            services.abuse(context.env),
            policies,
            keys,
            services.now(),
        );
        if (decision === 'allow') return null;
        if (decision === 'blocked') {
            return context.json({ code: 'TOO_MANY_REQUESTS' }, 429);
        }
        const action = policies[0].action;
        const ipAddress = context.req.header('cf-connecting-ip') || 'local-or-unknown';
        if (
            typeof token === 'string' &&
            services.verifyTurnstile &&
            (await services.verifyTurnstile(context.env, {
                token,
                action,
                ipAddress,
            }))
        ) {
            return null;
        }
        return context.env.TURNSTILE_SITE_KEY
            ? context.json(
                  {
                      code: 'TURNSTILE_REQUIRED',
                      siteKey: context.env.TURNSTILE_SITE_KEY,
                      action,
                  },
                  403,
              )
            : context.json({ code: 'TOO_MANY_REQUESTS' }, 429);
    };

    const tryDispatchReport = async (environment: Bindings, pairId: string) => {
        if (!services.reports || !services.enqueueReport) return;
        try {
            await dispatchReportJobs(
                services.reports(environment),
                (message) => services.enqueueReport!(environment, message),
                services.now().toISOString(),
                pairId,
            );
        } catch {
            console.error('Report job remains pending for scheduled retry', { pairId });
        }
    };

    const getAccount = async (context: {
        env: Bindings;
        req: { raw: Request };
    }) => {
        const session = await services
            .auth(context.env)
            .getSession(context.req.raw.headers);
        if (!session) return null;

        const consents = await services
            .accounts(context.env)
            .getConsents(session.user.id);

        return {
            session,
            consentState: getConsentState(consents),
        };
    };

    app.post('/api/auth/email-otp/send-verification-otp', async (context) => {
        const body = (await context.req.json().catch(() => null)) as {
            email?: unknown;
            type?: unknown;
            turnstileToken?: unknown;
        } | null;
        if (
            typeof body?.email !== 'string' ||
            body.type !== 'sign-in' ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
        ) {
            return context.json({ code: 'INVALID_EMAIL' }, 400);
        }

        const ipAddress =
            context.req.header('cf-connecting-ip') || 'local-or-unknown';
        const abuseResponse = await guardAbuse(
            context,
            OTP_ABUSE_POLICIES,
            {
                otp_email: body.email.trim().toLowerCase(),
                otp_ip: ipAddress,
            },
            body.turnstileToken,
        );
        if (abuseResponse) return abuseResponse;
        try {
            await services
                .auth(context.env)
                .sendSignInOtp(body.email, ipAddress);
            return context.json({ success: true });
        } catch (error) {
            if (error instanceof OtpRequestError) {
                return context.json(
                    { code: error.code, message: error.message },
                    error.status,
                );
            }
            throw error;
        }
    });

    app.all('/api/auth/*', (context) =>
        services.auth(context.env).handler(context.req.raw),
    );

    app.get('/api/account', async (context) => {
        const account = await getAccount(context);
        if (!account) return context.json({ signedIn: false });

        return context.json({
            signedIn: true,
            displayName: account.session.user.name,
            consentState: account.consentState,
        });
    });

    app.get('/api/content-library/v1/review', (context) =>
        context.json(contentLibraryV1),
    );

    app.post('/api/account/registration', async (context) => {
        const session = await services
            .auth(context.env)
            .getSession(context.req.raw.headers);
        if (!session) return context.json({ code: 'UNAUTHORIZED' }, 401);

        const body: unknown = await context.req.json().catch(() => null);
        const abuseResponse = await guardAbuse(
            context,
            [ACCOUNT_ABUSE_POLICY],
            {
                account_ip:
                    context.req.header('cf-connecting-ip') || 'local-or-unknown',
            },
            undefined,
        );
        if (abuseResponse) return abuseResponse;
        if (!hasRequiredAcknowledgements(body)) {
            return context.json({ code: 'ACKNOWLEDGEMENTS_REQUIRED' }, 400);
        }

        const displayName = validateDisplayName(
            (body as Record<string, unknown>).displayName,
        );
        if (!displayName.ok) {
            return context.json({ code: displayName.code }, 400);
        }

        await services.accounts(context.env).completeRegistration({
            userId: session.user.id,
            name: displayName.value,
            acceptedAt: services.now().toISOString(),
        });

        return context.json({
            displayName: displayName.value,
            consentState: 'current',
        });
    });

    app.post('/api/account/consent', async (context) => {
        const account = await getAccount(context);
        if (!account) return context.json({ code: 'UNAUTHORIZED' }, 401);

        const body: unknown = await context.req.json().catch(() => null);
        if (!hasRequiredAcknowledgements(body)) {
            return context.json({ code: 'ACKNOWLEDGEMENTS_REQUIRED' }, 400);
        }

        await services
            .accounts(context.env)
            .renewConsents(
                account.session.user.id,
                services.now().toISOString(),
            );

        return context.json({ consentState: 'current' });
    });

    app.get('/api/privacy/export', async (context) => {
        const account = await getAccount(context);
        if (!account) return context.json({ code: 'UNAUTHORIZED' }, 401);
        if (!services.privacy) {
            return context.json({ code: 'PRIVACY_UNAVAILABLE' }, 503);
        }
        const exportedAt = services.now().toISOString();
        const data = await services
            .privacy(context.env)
            .exportData(account.session.user.id, exportedAt);
        if (!data) return context.json({ code: 'ACCOUNT_NOT_FOUND' }, 404);
        return new Response(JSON.stringify(data, null, 2), {
            headers: {
                'content-type': 'application/json; charset=UTF-8',
                'content-disposition': `attachment; filename="cofounder-data-${exportedAt.slice(0, 10)}.json"`,
                'cache-control': 'no-store',
            },
        });
    });

    app.post('/api/privacy/challenge', async (context) => {
        const account = await getAccount(context);
        if (!account) return context.json({ code: 'UNAUTHORIZED' }, 401);
        const auth = services.auth(context.env);
        if (!auth.sendPrivacyOtp) {
            return context.json({ code: 'PRIVACY_UNAVAILABLE' }, 503);
        }
        try {
            await auth.sendPrivacyOtp(
                account.session.user.id,
                account.session.user.email,
                context.req.header('cf-connecting-ip') || 'local-or-unknown',
            );
            return context.json({ success: true, expiresIn: OTP_EXPIRES_IN_SECONDS });
        } catch (error) {
            if (error instanceof OtpRequestError) {
                return context.json(
                    { code: error.code, message: error.message },
                    error.status,
                );
            }
            throw error;
        }
    });

    app.post('/api/privacy/authorize', async (context) => {
        const account = await getAccount(context);
        if (!account) return context.json({ code: 'UNAUTHORIZED' }, 401);
        const body = (await context.req.json().catch(() => null)) as {
            otp?: unknown;
        } | null;
        const auth = services.auth(context.env);
        if (
            typeof body?.otp !== 'string' ||
            !auth.verifyPrivacyOtp ||
            !(await auth.verifyPrivacyOtp(account.session.user.id, body.otp))
        ) {
            return context.json({ code: 'INVALID_OTP' }, 400);
        }
        return context.json({ authorized: true, validForSeconds: 5 * 60 });
    });

    const consumePrivacyAuthorization = async (
        context: Parameters<MiddlewareHandler<AppEnvironment>>[0],
    ) => {
        const account = await getAccount(context);
        if (!account) return { error: context.json({ code: 'UNAUTHORIZED' }, 401) };
        const consume = services.auth(context.env).consumePrivacyAuthorization;
        if (!consume || !(await consume(account.session.user.id))) {
            return {
                error: context.json({ code: 'FRESH_OTP_REQUIRED' }, 428),
            };
        }
        return { account };
    };

    app.delete('/api/privacy/pairs/:pairId', async (context) => {
        const authorization = await consumePrivacyAuthorization(context);
        if ('error' in authorization) return authorization.error;
        if (!services.privacy) {
            return context.json({ code: 'PRIVACY_UNAVAILABLE' }, 503);
        }
        const withdrawn = await services
            .privacy(context.env)
            .withdrawFromPair(
                context.req.param('pairId'),
                authorization.account.session.user.id,
                services.now().toISOString(),
            );
        if (withdrawn) {
            const pairId = context.req.param('pairId');
            const userId = authorization.account.session.user.id;
            await recordEvent(context.env, {
                eventId: `participant_withdrawn:${pairId}:${userId}`,
                pairId,
                userId,
                type: 'participant_withdrawn',
                createdAt: services.now().toISOString(),
            });
        }
        return withdrawn
            ? context.json({ withdrawn: true })
            : context.json({ code: 'PAIR_NOT_FOUND' }, 404);
    });

    app.delete('/api/privacy/account', async (context) => {
        const authorization = await consumePrivacyAuthorization(context);
        if ('error' in authorization) return authorization.error;
        if (!services.privacy) {
            return context.json({ code: 'PRIVACY_UNAVAILABLE' }, 503);
        }
        const deleted = await services.privacy(context.env).deleteAccount({
            userId: authorization.account.session.user.id,
            deletedAt: services.now().toISOString(),
            tombstoneEmail: `deleted+${services.id()}@invalid.local`,
        });
        return deleted
            ? context.json({ deleted: true })
            : context.json({ code: 'ACCOUNT_NOT_FOUND' }, 404);
    });

    const requireCurrentConsent: MiddlewareHandler<AppEnvironment> = async (
        context,
        next,
    ) => {
        const account = await getAccount(context);
        if (!account) return context.json({ code: 'UNAUTHORIZED' }, 401);
        if (account.consentState !== 'current') {
            return context.json({ code: 'CONSENT_RENEWAL_REQUIRED' }, 428);
        }
        context.set('account', account);
        await next();
    };

    app.use('/api/pairs/*', requireCurrentConsent);
    app.use('/api/questionnaire/*', requireCurrentConsent);

    const pairResponse = (pair: PairTestRecord) => ({
        pairId: pair.pairId,
        role: pair.role,
        lifecycle: pair.lifecycle,
        reportStatus: pair.reportStatus,
        notificationReady: pair.reportStatus === 'ready',
        partnerStatus: pair.partnerStatus,
        invitationStatus: pair.invitationStatus,
        questionSetVersion: pair.questionSetVersion,
        revision: pair.revision,
        status: pair.submittedAt ? ('submitted' as const) : ('draft' as const),
        profile: pair.state.profile,
        answers: pair.state.answers,
        submittedAt: pair.submittedAt,
    });

    const writeError = (
        context: Parameters<MiddlewareHandler<AppEnvironment>>[0],
        result: PairWriteResult,
    ) => {
        if (result === 'not_found') {
            return context.json({ code: 'PAIR_NOT_FOUND' }, 404);
        }
        if (result === 'sealed') {
            return context.json({ code: 'PAIR_TEST_SEALED' }, 409);
        }
        if (result === 'conflict') {
            return context.json({ code: 'REVISION_CONFLICT' }, 409);
        }
        return null;
    };

    app.get('/api/questionnaire/current', (context) =>
        context.json(publicQuestionnaire),
    );

    app.get('/api/questionnaire/:version', (context) => {
        const version = getQuestionnaireVersion(context.req.param('version'));
        return version
            ? context.json(version.questionnaire)
            : context.json({ code: 'QUESTION_SET_NOT_FOUND' }, 404);
    });

    app.get('/api/invitations/:token', async (context) => {
        const token = context.req.param('token');
        if (!token || token.length > 200) {
            return context.json({ code: 'INVITATION_NOT_FOUND' }, 404);
        }
        const invitation = await services
            .pairs(context.env)
            .findInvitation(await hashInvitationToken(token));

        if (!invitation) {
            return context.json({ code: 'INVITATION_NOT_FOUND' }, 404);
        }
        await recordEvent(context.env, {
            eventId: `partner_opened:${invitation.pairId}`,
            pairId: invitation.pairId,
            type: 'partner_opened',
            createdAt: services.now().toISOString(),
        });
        return context.json({ creatorDisplayName: invitation.creatorDisplayName });
    });

    app.post('/api/invitations/:token/claim', async (context) => {
        const account = await getAccount(context);
        if (!account) return context.json({ code: 'UNAUTHORIZED' }, 401);
        if (account.consentState !== 'current') {
            return context.json({ code: 'CONSENT_RENEWAL_REQUIRED' }, 428);
        }
        if (!validateDisplayName(account.session.user.name).ok) {
            return context.json({ code: 'DISPLAY_NAME_REQUIRED' }, 428);
        }
        const body = (await context.req.json().catch(() => null)) as {
            accepted?: unknown;
        } | null;
        if (body?.accepted !== true) {
            return context.json({ code: 'INVITATION_ACCEPTANCE_REQUIRED' }, 400);
        }
        const token = context.req.param('token');
        if (!token || token.length > 200) {
            return context.json({ code: 'INVITATION_NOT_FOUND' }, 404);
        }
        const result = await services.pairs(context.env).claimInvitation(
            await hashInvitationToken(token),
            account.session.user.id,
            services.now().toISOString(),
        );
        if (result === 'same_account') {
            return context.json({ code: 'SELF_INVITATION' }, 409);
        }
        if (result === 'unavailable') {
            return context.json({ code: 'INVITATION_NOT_FOUND' }, 404);
        }
        await recordEvent(context.env, {
            eventId: `partner_started:${result.pairId}`,
            pairId: result.pairId,
            userId: account.session.user.id,
            type: 'partner_started',
            createdAt: services.now().toISOString(),
        });
        return context.json(pairResponse(result));
    });

    app.post('/api/pairs', async (context) => {
        const account = context.get('account');
        const body = (await context.req.json().catch(() => ({}))) as {
            turnstileToken?: unknown;
        };
        const abuseResponse = await guardAbuse(
            context,
            PAIR_ABUSE_POLICIES,
            {
                pair_user: account.session.user.id,
                pair_ip:
                    context.req.header('cf-connecting-ip') || 'local-or-unknown',
            },
            body.turnstileToken,
        );
        if (abuseResponse) return abuseResponse;
        const createdAt = services.now().toISOString();
        const pair = await services.pairs(context.env).create({
            pairId: services.id(),
            userId: account.session.user.id,
            questionSetVersion: QUESTION_SET_VERSION,
            createdAt,
        });

        if (!pair) return context.json({ code: 'ACTIVE_PAIR_LIMIT' }, 409);
        await recordEvent(context.env, {
            eventId: `test_started:${pair.pairId}`,
            pairId: pair.pairId,
            userId: account.session.user.id,
            type: 'test_started',
            createdAt,
        });
        return context.json(pairResponse(pair), 201);
    });

    app.get('/api/pairs', async (context) => {
        const pairs = await services
            .pairs(context.env)
            .listForUser(context.get('account').session.user.id);

        return context.json({ pairs: pairs.map(pairResponse) });
    });

    app.get('/api/pairs/:pairId/test', async (context) => {
        const pair = await services
            .pairs(context.env)
            .get(context.req.param('pairId'), context.get('account').session.user.id);

        return pair
            ? context.json(pairResponse(pair))
            : context.json({ code: 'PAIR_NOT_FOUND' }, 404);
    });

    app.put('/api/pairs/:pairId/profile', async (context) => {
        const body = (await context.req.json().catch(() => null)) as {
            revision?: unknown;
            profile?: unknown;
        } | null;
        if (!Number.isInteger(body?.revision) || !validateProfile(body?.profile)) {
            return context.json({ code: 'INVALID_PROFILE' }, 400);
        }

        const repository = services.pairs(context.env);
        const pairId = context.req.param('pairId');
        const userId = context.get('account').session.user.id;
        const pair = await repository.get(pairId, userId);
        if (!pair) return context.json({ code: 'PAIR_NOT_FOUND' }, 404);
        const questionSet = getQuestionnaireVersion(pair.questionSetVersion);
        if (!questionSet) {
            return context.json({ code: 'QUESTION_SET_NOT_FOUND' }, 409);
        }
        const state = structuredClone(pair.state);
        state.profile = body.profile;
        const result = await repository.save(
            pairId,
            userId,
            body.revision as number,
            state,
            services.now().toISOString(),
        );
        const error = writeError(context, result);

        return error || context.json(pairResponse(result as PairTestRecord));
    });

    app.put('/api/pairs/:pairId/answers/:section/:questionId', async (context) => {
        const body = (await context.req.json().catch(() => null)) as {
            revision?: unknown;
            optionId?: unknown;
        } | null;
        const section = context.req.param('section');
        const questionId = context.req.param('questionId');
        const revision = body?.revision;
        const optionId = body?.optionId;
        if (!Number.isInteger(revision) || typeof optionId !== 'string') {
            return context.json({ code: 'INVALID_ANSWER' }, 400);
        }

        const repository = services.pairs(context.env);
        const pairId = context.req.param('pairId');
        const userId = context.get('account').session.user.id;
        const pair = await repository.get(pairId, userId);
        if (!pair) return context.json({ code: 'PAIR_NOT_FOUND' }, 404);
        const questionSet = getQuestionnaireVersion(pair.questionSetVersion);
        if (!questionSet) {
            return context.json({ code: 'QUESTION_SET_NOT_FOUND' }, 409);
        }
        if (!questionSet.isValidAnswer(section, questionId, optionId)) {
            return context.json({ code: 'INVALID_ANSWER' }, 400);
        }
        const state = structuredClone(pair.state);
        state.answers[`${section}:${questionId}`] = optionId as string;
        const result = await repository.save(
            pairId,
            userId,
            revision as number,
            state,
            services.now().toISOString(),
        );
        const error = writeError(context, result);

        return error || context.json(pairResponse(result as PairTestRecord));
    });

    app.post('/api/pairs/:pairId/submit', async (context) => {
        const body = (await context.req.json().catch(() => null)) as {
            revision?: unknown;
        } | null;
        const revision = body?.revision;
        if (!Number.isInteger(revision)) {
            return context.json({ code: 'INVALID_REVISION' }, 400);
        }

        const repository = services.pairs(context.env);
        const pairId = context.req.param('pairId');
        const userId = context.get('account').session.user.id;
        const pair = await repository.get(pairId, userId);
        if (!pair) return context.json({ code: 'PAIR_NOT_FOUND' }, 404);
        if (pair.submittedAt) {
            await tryDispatchReport(context.env, pairId);
            return context.json({ code: 'PAIR_TEST_SEALED' }, 409);
        }
        const questionSet = getQuestionnaireVersion(pair.questionSetVersion);
        if (!questionSet) {
            return context.json({ code: 'QUESTION_SET_NOT_FOUND' }, 409);
        }
        const missingAnswers = questionSet.requiredAnswerKeys.filter(
            (key) => pair.state.answers[key] === undefined,
        );
        if (!pair.state.profile || missingAnswers.length > 0) {
            return context.json(
                {
                    code: 'PAIR_TEST_INCOMPLETE',
                    missingProfile: pair.state.profile === null,
                    missingAnswers,
                },
                400,
            );
        }

        const invitationToken = pair.role === 'creator' ? services.id() : null;
        const result = await repository.submit(
            pairId,
            userId,
            revision as number,
            services.now().toISOString(),
            invitationToken
                ? await hashInvitationToken(invitationToken)
                : undefined,
        );
        const error = writeError(context, result);

        if (!error) {
            const submitted = result as PairTestRecord;
            const createdAt = services.now().toISOString();
            await recordEvent(context.env, {
                eventId: `participant_completed:${pairId}:${userId}`,
                pairId,
                userId,
                type: 'participant_completed',
                createdAt,
            });
            if (invitationToken) {
                await recordEvent(context.env, {
                    eventId: `invitation_created:${pairId}`,
                    pairId,
                    userId,
                    type: 'invitation_created',
                    createdAt,
                });
            }
            if (
                submitted.lifecycle === 'pair_complete' ||
                submitted.lifecycle === 'report_generating' ||
                submitted.lifecycle === 'report_ready'
            ) {
                await recordEvent(context.env, {
                    eventId: `pair_completed:${pairId}`,
                    pairId,
                    type: 'pair_completed',
                    createdAt,
                });
            }
            await tryDispatchReport(context.env, pairId);
        }

        return (
            error ||
            context.json({
                ...pairResponse(result as PairTestRecord),
                ...(invitationToken
                    ? { invitation: { path: `/invite/${invitationToken}` } }
                    : {}),
            })
        );
    });

    app.get('/api/pairs/:pairId/report', async (context) => {
        const pairId = context.req.param('pairId');
        const pair = await services
            .pairs(context.env)
            .get(pairId, context.get('account').session.user.id);
        if (!pair) return context.json({ code: 'PAIR_NOT_FOUND' }, 404);
        if (pair.reportStatus !== 'ready') {
            return context.json({
                pairId,
                status: pair.reportStatus,
                notificationReady: false,
            });
        }

        const result = services.reports
            ? await services.reports(context.env).getResult(pairId)
            : null;
        if (!result) return context.json({ code: 'REPORT_NOT_FOUND' }, 404);
        const userId = context.get('account').session.user.id;
        await recordEvent(context.env, {
            eventId: `result_viewed:${pairId}:${userId}`,
            pairId,
            userId,
            type: 'result_viewed',
            createdAt: services.now().toISOString(),
        });
        return context.json({
            pairId,
            status: 'ready',
            notificationReady: true,
            report: result.report,
        });
    });

    app.get('/api/pairs/:pairId/public-result', async (context) => {
        if (!services.publicResults) {
            return context.json({ code: 'PUBLIC_RESULTS_UNAVAILABLE' }, 503);
        }
        const state = await services
            .publicResults(context.env)
            .getPairState(
                context.req.param('pairId'),
                context.get('account').session.user.id,
            );
        return state
            ? context.json(state)
            : context.json({ code: 'PAIR_NOT_FOUND' }, 404);
    });

    app.post('/api/pairs/:pairId/public-result', async (context) => {
        if (!services.publicResults) {
            return context.json({ code: 'PUBLIC_RESULTS_UNAVAILABLE' }, 503);
        }
        const body = (await context.req.json().catch(() => null)) as {
            showMyName?: unknown;
            turnstileToken?: unknown;
        } | null;
        if (typeof body?.showMyName !== 'boolean') {
            return context.json({ code: 'NAME_PERMISSION_REQUIRED' }, 400);
        }
        const userId = context.get('account').session.user.id;
        const abuseResponse = await guardAbuse(
            context,
            PUBLIC_ABUSE_POLICIES,
            { public_user: userId },
            body.turnstileToken,
        );
        if (abuseResponse) return abuseResponse;
        const slug = `${services.id()}${services.id()}`.replaceAll('-', '');
        const slugHash = await hashInvitationToken(slug);
        const repository = services.publicResults(context.env);
        const published = await repository.publish({
            pairId: context.req.param('pairId'),
            userId,
            slugHash,
            showMyName: body.showMyName,
            publishedAt: services.now().toISOString(),
        });
        if (published === 'not_found') {
            return context.json({ code: 'PAIR_NOT_FOUND' }, 404);
        }
        if (published === 'not_ready') {
            return context.json({ code: 'REPORT_NOT_READY' }, 409);
        }
        const lookup = await repository.findBySlugHash(slugHash);
        if (lookup?.status !== 'published') {
            return context.json({ code: 'PUBLIC_RESULT_NOT_FOUND' }, 500);
        }
        const pairId = context.req.param('pairId');
        await recordEvent(context.env, {
            eventId: `public_generated:${pairId}`,
            pairId,
            userId,
            type: 'public_generated',
            createdAt: services.now().toISOString(),
        });
        return context.json(
            {
                publicPath: `/r/${slug}`,
                result: lookup.result,
            },
            201,
        );
    });

    app.put('/api/pairs/:pairId/public-name', async (context) => {
        if (!services.publicResults) {
            return context.json({ code: 'PUBLIC_RESULTS_UNAVAILABLE' }, 503);
        }
        const body = (await context.req.json().catch(() => null)) as {
            permitted?: unknown;
        } | null;
        if (typeof body?.permitted !== 'boolean') {
            return context.json({ code: 'INVALID_NAME_PERMISSION' }, 400);
        }
        const updated = await services.publicResults(context.env).setNamePermission({
            pairId: context.req.param('pairId'),
            userId: context.get('account').session.user.id,
            permitted: body.permitted,
            updatedAt: services.now().toISOString(),
        });
        return updated
            ? context.json({ myNamePublic: body.permitted })
            : context.json({ code: 'PAIR_NOT_FOUND' }, 404);
    });

    app.delete('/api/pairs/:pairId/public-result', async (context) => {
        if (!services.publicResults) {
            return context.json({ code: 'PUBLIC_RESULTS_UNAVAILABLE' }, 503);
        }
        const unpublished = await services
            .publicResults(context.env)
            .unpublish(
                context.req.param('pairId'),
                context.get('account').session.user.id,
                services.now().toISOString(),
            );
        return unpublished
            ? context.json({ published: false })
            : context.json({ code: 'PUBLIC_RESULT_NOT_FOUND' }, 404);
    });

    app.get('/api/public-results/:slug', async (context) => {
        if (!services.publicResults) {
            return context.json({ status: 'unavailable' }, 404);
        }
        const slug = context.req.param('slug');
        if (!/^[a-zA-Z0-9]{40,200}$/.test(slug)) {
            return context.json({ status: 'unavailable' }, 404);
        }
        const repository = services.publicResults(context.env);
        const slugHash = await hashInvitationToken(slug);
        const lookup = await repository.findBySlugHash(slugHash);
        if (lookup?.status === 'published') {
            const pairId = await repository.findPairIdBySlugHash?.(slugHash);
            if (pairId) {
                await recordEvent(context.env, {
                    eventId: `public_result_viewed:${pairId}`,
                    pairId,
                    type: 'result_viewed',
                    createdAt: services.now().toISOString(),
                });
            }
            return context.json(lookup.result);
        }
        return lookup?.status === 'withdrawn'
            ? context.json({ status: 'withdrawn' }, 410)
            : context.json({ status: 'unavailable' }, 404);
    });

    app.post('/api/public-results/:slug/share', async (context) => {
        const body = (await context.req.json().catch(() => null)) as {
            action?: unknown;
        } | null;
        const actions = new Set([
            'web_share',
            'link_copy',
            'receipt_download',
            'qr_download',
        ]);
        if (typeof body?.action !== 'string' || !actions.has(body.action)) {
            return context.json({ code: 'INVALID_SHARE_ACTION' }, 400);
        }
        const slug = context.req.param('slug');
        if (!services.publicResults || !/^[a-zA-Z0-9]{40,200}$/.test(slug)) {
            return context.json({ code: 'PUBLIC_RESULT_NOT_FOUND' }, 404);
        }
        const pairId = await services
            .publicResults(context.env)
            .findPairIdBySlugHash?.(await hashInvitationToken(slug));
        if (!pairId) {
            return context.json({ code: 'PUBLIC_RESULT_NOT_FOUND' }, 404);
        }
        await recordEvent(context.env, {
            eventId: `pair_shared:${pairId}`,
            pairId,
            type: 'pair_shared',
            createdAt: services.now().toISOString(),
        });
        return context.json({ recorded: true });
    });

    app.post('/api/pairs/:pairId/invitation-share', async (context) => {
        const pairId = context.req.param('pairId');
        const userId = context.get('account').session.user.id;
        const pair = await services.pairs(context.env).get(pairId, userId);
        if (!pair) return context.json({ code: 'PAIR_NOT_FOUND' }, 404);
        if (pair.role !== 'creator' || pair.invitationStatus !== 'active') {
            return context.json({ code: 'INVITATION_NOT_FOUND' }, 409);
        }
        await recordEvent(context.env, {
            eventId: `invitation_shared:${pairId}`,
            pairId,
            userId,
            type: 'invitation_shared',
            createdAt: services.now().toISOString(),
        });
        return context.json({ recorded: true });
    });

    app.post('/api/pairs/:pairId/invitation', async (context) => {
        const body = (await context.req.json().catch(() => null)) as {
            action?: unknown;
        } | null;
        if (body?.action !== 'reset' && body?.action !== 'cancel') {
            return context.json({ code: 'INVALID_INVITATION_ACTION' }, 400);
        }
        const repository = services.pairs(context.env);
        const pairId = context.req.param('pairId');
        const userId = context.get('account').session.user.id;
        const now = services.now().toISOString();
        const invitationToken = body.action === 'reset' ? services.id() : null;
        const result = invitationToken
            ? await repository.resetInvitation(
                  pairId,
                  userId,
                  await hashInvitationToken(invitationToken),
                  now,
              )
            : await repository.cancelInvitation(pairId, userId, now);
        if (result === 'not_found') {
            return context.json({ code: 'PAIR_NOT_FOUND' }, 404);
        }
        if (result === 'invitation_locked') {
            return context.json({ code: 'INVITATION_LOCKED' }, 409);
        }
        return context.json({
            ...pairResponse(result),
            ...(invitationToken
                ? { invitation: { path: `/invite/${invitationToken}` } }
                : {}),
        });
    });

    app.get('/', (context) =>
        fetchShell(context.env.ASSETS, '/index.html', context.env.WEB_ANALYTICS_TOKEN),
    );

    app.get('/desktop', (context) =>
        fetchShell(
            context.env.ASSETS,
            '/desktop/index.html',
            context.env.WEB_ANALYTICS_TOKEN,
        ),
    );
    app.get('/desktop/*', async (context) => {
        const asset = await context.env.ASSETS.fetch(context.req.raw);

        return asset.status === 404
            ? fetchShell(
                  context.env.ASSETS,
                  '/desktop/index.html',
                  context.env.WEB_ANALYTICS_TOKEN,
              )
            : asset;
    });

    app.get('/r/:slug', async (context) => {
        const slug = context.req.param('slug');
        const lookup =
            services.publicResults && /^[a-zA-Z0-9]{40,200}$/.test(slug)
                ? await services
                      .publicResults(context.env)
                      .findBySlugHash(await hashInvitationToken(slug))
                : null;
        return publicResultShell(
            context.env.ASSETS,
            lookup?.status === 'published' ? lookup.result : null,
            lookup?.status === 'withdrawn',
            context.env.WEB_ANALYTICS_TOKEN,
        );
    });

    app.get('/invite/*', (context) =>
        fetchShell(context.env.ASSETS, '/index.html', context.env.WEB_ANALYTICS_TOKEN),
    );

    app.get('/auth/*', (context) =>
        fetchShell(
            context.env.ASSETS,
            '/desktop/index.html',
            context.env.WEB_ANALYTICS_TOKEN,
        ),
    );

    app.get('/media/*', async (context) => {
        const key = context.req.path.slice('/media/'.length);
        const object = key ? await context.env.MEDIA.get(key) : null;

        if (!object) {
            return context.text('Media not found', 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        return new Response(object.body, { headers });
    });

    app.all('*', (context) => context.env.ASSETS.fetch(context.req.raw));

    return app;
};

export const app = createApp();

const worker: ExportedHandler<Bindings, GenerateReportMessage> = {
    fetch: (request, environment, executionContext) =>
        app.fetch(request, environment, executionContext),
    async queue(batch, environment) {
        const repository = createReportRepository(environment.DB);
        for (const message of batch.messages) {
            if (message.body.type !== 'generate-report') {
                message.ack();
                continue;
            }
            try {
                await processPairReport(repository, message.body.pairId, {
                    classifier: createJevClassifier({
                        jevApiKey: environment.JEV_API_KEY,
                        openRouterApiKey: environment.OPENROUTER_API_KEY,
                        confidenceThreshold: confidenceThreshold(
                            environment.JEV_CONFIDENCE_THRESHOLD,
                        ),
                    }),
                });
                await repository.markJobCompleted(
                    message.body.pairId,
                    new Date().toISOString(),
                );
                message.ack();
            } catch {
                message.retry();
            }
        }
    },
    async scheduled(_controller, environment) {
        const now = new Date();
        const repository = createReportRepository(environment.DB);
        try {
            await dispatchReportJobs(
                repository,
                (message) => environment.REPORT_QUEUE.send(message).then(() => undefined),
                now.toISOString(),
            );
        } catch {
            console.error('Scheduled report dispatch remains pending');
        }
        await runDefaultPairLifecycle(environment, now);
    },
};

export default worker;
