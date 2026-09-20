import { describe, expect, it } from 'bun:test';
import { renderOtpEmail } from './email-template';

describe('OTP email template', () => {
    it('renders a visible six-digit code without a magic link', () => {
        const email = renderOtpEmail('482913');

        expect(email.subject).toContain('482913');
        expect(email.html).toContain('482913');
        expect(email.text).toContain('482913');
        expect(email.html).toContain('10 分钟');
        expect(email.html).not.toContain('href=');
    });

    it('rejects malformed codes instead of interpolating unsafe content', () => {
        expect(() => renderOtpEmail('<script>')).toThrow('Invalid OTP');
    });
});
