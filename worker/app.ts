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
    now(): Date;
};

const defaultServices: AppServices = {
    auth: createAuth,
    accounts: (environment) => createAccountRepository(environment.DB),
    now: () => new Date(),
};

type AppEnvironment = { Bindings: Bindings };

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
        await next();
    };

    app.use('/api/pairs/*', requireCurrentConsent);
    app.use('/api/questionnaire/*', requireCurrentConsent);
    app.all('/api/pairs/*', (context) =>
        context.json({ code: 'NOT_IMPLEMENTED' }, 501),
    );
    app.all('/api/questionnaire/*', (context) =>
        context.json({ code: 'NOT_IMPLEMENTED' }, 501),
    );

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
