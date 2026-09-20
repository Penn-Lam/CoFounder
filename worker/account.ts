export const CURRENT_CONSENTS = {
    age_eligibility: '14-plus-v1',
    terms_privacy: 'terms-privacy-v1',
    overseas_classifier: 'overseas-classifier-v1',
} as const;

export type ConsentType = keyof typeof CURRENT_CONSENTS;

export type ConsentRecord = {
    type: ConsentType;
    version: string;
};

export type ConsentState = 'missing' | 'renewal_required' | 'current';

export const getConsentState = (records: ConsentRecord[]): ConsentState => {
    if (records.length === 0) return 'missing';

    const versions = new Map(records.map(({ type, version }) => [type, version]));
    const current = Object.entries(CURRENT_CONSENTS).every(
        ([type, version]) => versions.get(type as ConsentType) === version,
    );

    return current ? 'current' : 'renewal_required';
};

type DisplayNameResult =
    | { ok: true; value: string }
    | {
          ok: false;
          code: 'DISPLAY_NAME_LENGTH' | 'DISPLAY_NAME_CONTROL_CHARACTER';
      };

export const validateDisplayName = (input: unknown): DisplayNameResult => {
    if (typeof input !== 'string') {
        return { ok: false, code: 'DISPLAY_NAME_LENGTH' };
    }

    const value = input.trim().normalize('NFC');
    const length = Array.from(value).length;

    if (length < 1 || length > 32) {
        return { ok: false, code: 'DISPLAY_NAME_LENGTH' };
    }

    if (/\p{Cc}|\p{Cf}/u.test(value)) {
        return { ok: false, code: 'DISPLAY_NAME_CONTROL_CHARACTER' };
    }

    return { ok: true, value };
};

export const hasRequiredAcknowledgements = (input: unknown) => {
    if (!input || typeof input !== 'object') return false;
    const acknowledgements = input as Record<string, unknown>;

    return (
        acknowledgements.ageEligible === true &&
        acknowledgements.termsPrivacy === true &&
        acknowledgements.overseasClassifier === true
    );
};
