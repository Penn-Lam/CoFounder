import { describe, expect, it } from 'bun:test';
import {
    CURRENT_CONSENTS,
    getConsentState,
    validateDisplayName,
} from './account';
import {
    OTP_ALLOWED_ATTEMPTS,
    OTP_EXPIRES_IN_SECONDS,
    OTP_RESEND_DELAY_SECONDS,
    SESSION_EXPIRES_IN_SECONDS,
    SESSION_UPDATE_AGE_SECONDS,
} from './auth';

describe('display-name validation', () => {
    it('trims a valid name without deriving it from email', () => {
        expect(validateDisplayName('  Garage Founder  ')).toEqual({
            ok: true,
            value: 'Garage Founder',
        });
    });

    it('counts Unicode code points rather than UTF-16 units', () => {
        expect(validateDisplayName('🚀'.repeat(32))).toEqual({
            ok: true,
            value: '🚀'.repeat(32),
        });
        expect(validateDisplayName('🚀'.repeat(33))).toEqual({
            ok: false,
            code: 'DISPLAY_NAME_LENGTH',
        });
    });

    it('rejects blank names and invisible control characters', () => {
        expect(validateDisplayName('   ')).toEqual({
            ok: false,
            code: 'DISPLAY_NAME_LENGTH',
        });
        expect(validateDisplayName('Founder\u0000')).toEqual({
            ok: false,
            code: 'DISPLAY_NAME_CONTROL_CHARACTER',
        });
        expect(validateDisplayName('Founder\u202e')).toEqual({
            ok: false,
            code: 'DISPLAY_NAME_CONTROL_CHARACTER',
        });
    });
});

describe('consent version state', () => {
    it('requires every current consent version', () => {
        expect(
            getConsentState([
                { type: 'age_eligibility', version: CURRENT_CONSENTS.age_eligibility },
                { type: 'terms_privacy', version: CURRENT_CONSENTS.terms_privacy },
                {
                    type: 'overseas_classifier',
                    version: CURRENT_CONSENTS.overseas_classifier,
                },
            ]),
        ).toBe('current');

        expect(
            getConsentState([
                { type: 'age_eligibility', version: CURRENT_CONSENTS.age_eligibility },
                { type: 'terms_privacy', version: 'privacy-v0' },
                {
                    type: 'overseas_classifier',
                    version: CURRENT_CONSENTS.overseas_classifier,
                },
            ]),
        ).toBe('renewal_required');
    });

    it('distinguishes a new Account from one needing renewal', () => {
        expect(getConsentState([])).toBe('missing');
    });
});

describe('authentication contract', () => {
    it('keeps the confirmed OTP and rotating-session boundaries', () => {
        expect(OTP_EXPIRES_IN_SECONDS).toBe(600);
        expect(OTP_ALLOWED_ATTEMPTS).toBe(5);
        expect(OTP_RESEND_DELAY_SECONDS).toBe(60);
        expect(SESSION_EXPIRES_IN_SECONDS).toBe(30 * 24 * 60 * 60);
        expect(SESSION_UPDATE_AGE_SECONDS).toBeLessThan(
            SESSION_EXPIRES_IN_SECONDS,
        );
    });
});
