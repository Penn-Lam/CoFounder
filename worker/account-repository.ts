import {
    CURRENT_CONSENTS,
    type ConsentRecord,
    type ConsentType,
} from './account';

export type RegistrationRecord = {
    userId: string;
    name: string;
    acceptedAt: string;
};

export interface AccountRepository {
    getConsents(userId: string): Promise<ConsentRecord[]>;
    completeRegistration(record: RegistrationRecord): Promise<void>;
    renewConsents(userId: string, acceptedAt: string): Promise<void>;
}

type ConsentRow = {
    consent_type: ConsentType;
    version: string;
};

const consentStatements = (
    database: D1Database,
    userId: string,
    acceptedAt: string,
) =>
    Object.entries(CURRENT_CONSENTS).map(([type, version]) =>
        database
            .prepare(
                `INSERT INTO account_consent
                    (user_id, consent_type, version, consented_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT (user_id, consent_type) DO UPDATE SET
                    version = excluded.version,
                    consented_at = excluded.consented_at`,
            )
            .bind(userId, type, version, acceptedAt),
    );

export const createAccountRepository = (
    database: D1Database,
): AccountRepository => ({
    async getConsents(userId) {
        const result = await database
            .prepare(
                `SELECT consent_type, version
                 FROM account_consent
                 WHERE user_id = ?`,
            )
            .bind(userId)
            .all<ConsentRow>();

        return result.results.map((row) => ({
            type: row.consent_type,
            version: row.version,
        }));
    },

    async completeRegistration({ userId, name, acceptedAt }) {
        await database.batch([
            database
                .prepare('UPDATE user SET name = ?, updatedAt = ? WHERE id = ?')
                .bind(name, acceptedAt, userId),
            ...consentStatements(database, userId, acceptedAt),
        ]);
    },

    async renewConsents(userId, acceptedAt) {
        await database.batch(consentStatements(database, userId, acceptedAt));
    },
});
