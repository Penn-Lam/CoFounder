import { Hono } from 'hono';

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
};

const app = new Hono<{ Bindings: Bindings }>();

const fetchShell = (assets: AssetBinding, path: string) =>
    assets.fetch(new Request(`https://assets.local${path}`));

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

export default app;
