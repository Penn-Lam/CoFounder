import { describe, expect, it } from 'bun:test';
import app, { type Bindings } from './app';

const garageHtml = '<html><title>Garage</title></html>';
const desktopHtml = '<html><title>Cofounder Diagnostics</title></html>';

const createBindings = (
    media: Map<string, { body: string; contentType: string }> = new Map(),
): Bindings => ({
    ASSETS: {
        async fetch(input) {
            const path = new URL(typeof input === 'string' ? input : input.url)
                .pathname;

            if (path === '/index.html') {
                return new Response(garageHtml, {
                    headers: { 'content-type': 'text/html' },
                });
            }

            if (path === '/desktop/index.html') {
                return new Response(desktopHtml, {
                    headers: { 'content-type': 'text/html' },
                });
            }

            if (path === '/desktop/bundle.js') {
                return new Response('console.log("desktop")', {
                    headers: { 'content-type': 'text/javascript' },
                });
            }

            return new Response('asset not found', { status: 404 });
        },
    },
    MEDIA: {
        async get(key) {
            const object = media.get(key);
            if (!object) return null;

            return {
                body: object.body,
                httpEtag: '"media-etag"',
                writeHttpMetadata(headers) {
                    headers.set('content-type', object.contentType);
                },
            };
        },
    },
});

describe('Cofounder application shell', () => {
    it('serves the garage at the root', async () => {
        const response = await app.request('/', undefined, createBindings());

        expect(response.status).toBe(200);
        expect(await response.text()).toContain('<title>Garage</title>');
    });

    it.each(['/desktop', '/desktop/pairs'])(
        'serves the Diagnostics shell for %s',
        async (path) => {
            const response = await app.request(
                path,
                undefined,
                createBindings(),
            );

            expect(response.status).toBe(200);
            expect(await response.text()).toContain(
                '<title>Cofounder Diagnostics</title>',
            );
        },
    );

    it('serves Diagnostics assets instead of rewriting them to HTML', async () => {
        const response = await app.request(
            '/desktop/bundle.js',
            undefined,
            createBindings(),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('text/javascript');
        expect(await response.text()).toBe('console.log("desktop")');
    });

    it.each(['/invite/pair-token', '/auth/callback', '/r/result-slug'])(
        'bypasses the garage for %s',
        async (path) => {
            const response = await app.request(
                path,
                undefined,
                createBindings(),
            );

            expect(response.status).toBe(200);
            expect(await response.text()).toContain(
                '<title>Cofounder Diagnostics</title>',
            );
        },
    );

    it('serves oversized media from R2 with its metadata', async () => {
        const bindings = createBindings(
            new Map([
                [
                    'textures/monitor/video/real.mp4',
                    { body: 'video bytes', contentType: 'video/mp4' },
                ],
            ]),
        );

        const response = await app.request(
            '/media/textures/monitor/video/real.mp4',
            undefined,
            bindings,
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('video/mp4');
        expect(response.headers.get('etag')).toBe('"media-etag"');
        expect(await response.text()).toBe('video bytes');
    });

    it('returns 404 when an R2 object does not exist', async () => {
        const response = await app.request(
            '/media/missing.mp4',
            undefined,
            createBindings(),
        );

        expect(response.status).toBe(404);
    });

    it('passes unknown paths to the static asset binding', async () => {
        const response = await app.request(
            '/missing',
            undefined,
            createBindings(),
        );

        expect(response.status).toBe(404);
        expect(await response.text()).toBe('asset not found');
    });
});
