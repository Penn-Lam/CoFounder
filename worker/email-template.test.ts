import { describe, expect, it } from 'bun:test';
import { renderOtpEmail } from './email-template';
import { renderPairEmail } from './pair-email-template';

describe('OTP email template', () => {
    it('renders a visible six-digit code without a magic link', () => {
        const email = renderOtpEmail('482913');

        expect(email.subject).toContain('482913');
        expect(email.html).toContain('482913');
        expect(email.text).toContain('482913');
        expect(email.html).toContain('10 分钟');
        expect(email.html).toContain(
            'https://react-email-demo-b2ks236lh-resend.vercel.app/static/dither/dither-image-1.png',
        );
        expect(email.html).not.toContain('href=');
    });

    it('rejects malformed codes instead of interpolating unsafe content', () => {
        expect(() => renderOtpEmail('<script>')).toThrow('Invalid OTP');
    });
});

describe('Pair transactional email templates', () => {
    it('renders one expiry reminder without answers or result content', () => {
        const email = renderPairEmail('expiry_reminder', '2026-10-07 12:00:00');
        expect(email.subject).toContain('7 天');
        expect(email.text).toContain('2026-10-07');
        expect(`${email.subject}${email.html}${email.text}`).not.toMatch(
            /score|archetype|具体答案|维度得分|最大风险|镜像准确/i,
        );
    });

    it('renders a content-free Report Ready notice', () => {
        const email = renderPairEmail('report_ready');
        expect(email.subject).toContain('报告已准备好');
        expect(email.text).toContain('登录 Cofounder 查看');
        expect(`${email.subject}${email.html}${email.text}`).not.toMatch(
            /score|archetype|具体答案|维度得分|最大风险|镜像准确/i,
        );
    });
});
