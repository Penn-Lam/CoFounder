export type EmailDeliveryBindings = {
    RESEND_API_KEY: string;
    EMAIL_FROM: string;
};

export type EmailContent = {
    subject: string;
    html: string;
    text: string;
};

export class EmailDeliveryError extends Error {
    constructor(
        readonly status: number,
        readonly providerCode: string,
        readonly providerMessage: string,
    ) {
        super(`Email provider returned ${status}`);
    }
}

export const sendEmail = async (
    environment: EmailDeliveryBindings,
    email: string,
    content: EmailContent,
    idempotencyKey?: string,
) => {
    const headers: Record<string, string> = {
        authorization: `Bearer ${environment.RESEND_API_KEY}`,
        'content-type': 'application/json',
    };
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            from: environment.EMAIL_FROM,
            to: [email],
            subject: content.subject,
            html: content.html,
            text: content.text,
        }),
    });
    if (response.ok) return;

    const providerError = (await response.json().catch(() => null)) as {
        name?: unknown;
        message?: unknown;
    } | null;
    throw new EmailDeliveryError(
        response.status,
        typeof providerError?.name === 'string'
            ? providerError.name
            : 'unknown',
        typeof providerError?.message === 'string'
            ? providerError.message
            : 'unavailable',
    );
};
