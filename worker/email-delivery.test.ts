import { describe, expect, it } from 'bun:test';
import { sendEmail } from './email-delivery';

describe('email delivery', () => {
    it('passes a stable idempotency key for outbox retries', async () => {
        const originalFetch = globalThis.fetch;
        let requestHeaders = new Headers();
        globalThis.fetch = async (_input, init) => {
            requestHeaders = new Headers(init?.headers);
            return new Response(null, { status: 200 });
        };

        try {
            await sendEmail(
                {
                    RESEND_API_KEY: 'test-key',
                    EMAIL_FROM: 'Cofounder <test@example.com>',
                },
                'recipient@example.com',
                { subject: 'Ready', html: '<p>Ready</p>', text: 'Ready' },
                'report-ready:pair-1:user-1',
            );
            expect(requestHeaders.get('idempotency-key')).toBe(
                'report-ready:pair-1:user-1',
            );
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
