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
} & AuthBindings;

export type AppServices = {
    auth(environment: Bindings): AuthRuntime;
    accounts(environment: Bindings): AccountRepository;
    pairs(environment: Bindings): PairRepository;
    id(): string;
    now(): Date;
};

const defaultServices: AppServices = {
    auth: createAuth,
    accounts: (environment) => createAccountRepository(environment.DB),
    pairs: (environment) => createPairRepository(environment.DB),
    id: () => crypto.randomUUID(),
    now: () => new Date(),
};

type CurrentAccount = {
    session: NonNullable<Awaited<ReturnType<AuthRuntime['getSession']>>>;
    consentState: ReturnType<typeof getConsentState>;
};

type AppEnvironment = {
    Bindings: Bindings;
    Variables: { account: CurrentAccount };
};

const fetchShell = (assets: AssetBinding, path: string) =>
    assets.fetch(new Request(`https://assets.local${path}`));

export const createApp = (services: AppServices = defaultServices) => {
    const app = new Hono<AppEnvironment>();

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

    app.post('/api/account/registration', async (context) => {
        const session = await services
            .auth(context.env)
            .getSession(context.req.raw.headers);
        if (!session) return context.json({ code: 'UNAUTHORIZED' }, 401);

        const body: unknown = await context.req.json().catch(() => null);
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

    app.post('/api/pairs', async (context) => {
        const account = context.get('account');
        const createdAt = services.now().toISOString();
        const pair = await services.pairs(context.env).create({
            pairId: services.id(),
            userId: account.session.user.id,
            questionSetVersion: QUESTION_SET_VERSION,
            createdAt,
        });

        return pair
            ? context.json(pairResponse(pair), 201)
            : context.json({ code: 'ACTIVE_PAIR_LIMIT' }, 409);
    });

    app.get('/api/pairs', async (context) => {
        const pairs = await services
            .pairs(context.env)
            .listActive(context.get('account').session.user.id);

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
        if (pair.submittedAt) return context.json({ code: 'PAIR_TEST_SEALED' }, 409);
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

        const result = await repository.submit(
            pairId,
            userId,
            revision as number,
            services.now().toISOString(),
        );
        const error = writeError(context, result);

        return error || context.json(pairResponse(result as PairTestRecord));
    });

    app.get('/', (context) => fetchShell(context.env.ASSETS, '/index.html'));

    app.get('/desktop', (context) =>
        fetchShell(context.env.ASSETS, '/desktop/index.html'),
    );
    app.get('/desktop/*', async (context) => {
        const asset = await context.env.ASSETS.fetch(context.req.raw);

        return asset.status === 404
            ? fetchShell(context.env.ASSETS, '/desktop/index.html')
            : asset;
    });

    for (const path of ['/invite/*', '/auth/*', '/r/*']) {
        app.get(path, (context) =>
            fetchShell(context.env.ASSETS, '/desktop/index.html'),
        );
    }

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

export default createApp();
