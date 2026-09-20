export type PrivacyExport = {
    exportedAt: string;
    account: {
        id: string;
        displayName: string;
        email: string;
        createdAt: string;
        updatedAt: string;
    };
    consents: Array<{ type: string; version: string; consentedAt: string }>;
    ownPairData: Array<{
        pairId: string;
        role: 'creator' | 'partner';
        lifecycle: string;
        questionSetVersion: string | null;
        profile: unknown;
        answers: Record<string, string>;
        submittedAt: string | null;
        updatedAt: string | null;
    }>;
    sharedReports: Array<{ pairId: string; report: unknown; createdAt: string }>;
};

export interface PrivacyRepository {
    exportData(userId: string, exportedAt: string): Promise<PrivacyExport | null>;
    withdrawFromPair(pairId: string, userId: string, withdrawnAt: string): Promise<boolean>;
    deleteAccount(input: {
        userId: string;
        deletedAt: string;
        tombstoneEmail: string;
    }): Promise<boolean>;
}

type PairRole = { pair_id: string; role: 'creator' | 'partner' };

const pairRoles = async (database: D1Database, userId: string) => {
    const result = await database
        .prepare(
            `SELECT pair_id,
                    CASE WHEN creator_user_id = ? THEN 'creator' ELSE 'partner' END AS role
             FROM cofounder_pair
             WHERE creator_user_id = ? OR partner_user_id = ?`,
        )
        .bind(userId, userId, userId)
        .all<PairRole>();
    return result.results;
};

const withdrawalStatements = (
    database: D1Database,
    pairId: string,
    userId: string,
    role: 'creator' | 'partner',
    withdrawnAt: string,
) => [
    database
        .prepare(
            `INSERT OR IGNORE INTO pair_participant_withdrawal
                (pair_id, role, withdrawn_at) VALUES (?, ?, ?)`,
        )
        .bind(pairId, role, withdrawnAt),
    database
        .prepare('DELETE FROM pair_test WHERE pair_id = ? AND user_id = ?')
        .bind(pairId, userId),
    database.prepare('DELETE FROM pair_result WHERE pair_id = ?').bind(pairId),
    database.prepare('DELETE FROM report_job WHERE pair_id = ?').bind(pairId),
    database.prepare('DELETE FROM pair_event WHERE pair_id = ?').bind(pairId),
    database
        .prepare(
            `UPDATE cofounder_pair
             SET report_status = 'pending', report_generating_at = NULL,
                 report_ready_at = NULL, invite_token_hash = NULL,
                 invite_created_at = NULL, updated_at = ?
             WHERE pair_id = ?`,
        )
        .bind(withdrawnAt, pairId),
    database
        .prepare(
            `UPDATE public_result SET unpublished_at = ?
             WHERE pair_id = ? AND unpublished_at IS NULL`,
        )
        .bind(withdrawnAt, pairId),
    database
        .prepare('UPDATE public_result_slug SET active = 0 WHERE pair_id = ?')
        .bind(pairId),
    database
        .prepare(
            'DELETE FROM public_name_permission WHERE pair_id = ? AND user_id = ?',
        )
        .bind(pairId, userId),
];

export const createPrivacyRepository = (database: D1Database): PrivacyRepository => ({
    async exportData(userId, exportedAt) {
        const account = await database
            .prepare(
                `SELECT id, name, email, createdAt, updatedAt FROM user
                 WHERE id = ? AND NOT EXISTS (
                     SELECT 1 FROM account_deletion WHERE user_id = ?
                 )`,
            )
            .bind(userId, userId)
            .first<{
                id: string;
                name: string;
                email: string;
                createdAt: string;
                updatedAt: string;
            }>();
        if (!account) return null;

        const [consents, ownData, reports] = await Promise.all([
            database
                .prepare(
                    `SELECT consent_type, version, consented_at
                     FROM account_consent WHERE user_id = ? ORDER BY consent_type`,
                )
                .bind(userId)
                .all<{
                    consent_type: string;
                    version: string;
                    consented_at: string;
                }>(),
            database
                .prepare(
                    `SELECT pair.pair_id, test.question_set_version, test.state_json,
                            test.submitted_at, test.updated_at,
                            CASE WHEN pair.creator_user_id = ? THEN 'creator' ELSE 'partner' END AS role,
                            CASE
                                WHEN EXISTS (
                                    SELECT 1 FROM pair_participant_withdrawal withdrawal
                                    WHERE withdrawal.pair_id = pair.pair_id
                                ) THEN 'participant_withdrawn'
                                WHEN pair.report_status = 'ready' THEN 'report_ready'
                                WHEN pair.report_status = 'generating' THEN 'report_generating'
                                WHEN test.pair_id IS NULL THEN 'not_started'
                                WHEN test.submitted_at IS NULL THEN 'in_progress'
                                ELSE 'waiting_partner'
                            END AS lifecycle
                     FROM cofounder_pair pair
                     LEFT JOIN pair_test test
                       ON test.pair_id = pair.pair_id AND test.user_id = ?
                     WHERE pair.creator_user_id = ? OR pair.partner_user_id = ?
                     ORDER BY pair.created_at`,
                )
                .bind(userId, userId, userId, userId)
                .all<{
                    pair_id: string;
                    question_set_version: string | null;
                    state_json: string | null;
                    submitted_at: string | null;
                    updated_at: string | null;
                    role: 'creator' | 'partner';
                    lifecycle: string;
                }>(),
            database
                .prepare(
                    `SELECT result.pair_id, result.report_json, result.created_at
                     FROM pair_result result
                     JOIN cofounder_pair pair ON pair.pair_id = result.pair_id
                     WHERE pair.creator_user_id = ? OR pair.partner_user_id = ?
                     ORDER BY result.created_at`,
                )
                .bind(userId, userId)
                .all<{
                    pair_id: string;
                    report_json: string;
                    created_at: string;
                }>(),
        ]);

        return {
            exportedAt,
            account: {
                id: account.id,
                displayName: account.name,
                email: account.email,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt,
            },
            consents: consents.results.map((row) => ({
                type: row.consent_type,
                version: row.version,
                consentedAt: row.consented_at,
            })),
            ownPairData: ownData.results.map((row) => {
                const state = row.state_json
                    ? (JSON.parse(row.state_json) as {
                          profile: unknown;
                          answers: Record<string, string>;
                      })
                    : { profile: null, answers: {} };
                return {
                    pairId: row.pair_id,
                    role: row.role,
                    lifecycle: row.lifecycle,
                    questionSetVersion: row.question_set_version,
                    profile: state.profile,
                    answers: state.answers,
                    submittedAt: row.submitted_at,
                    updatedAt: row.updated_at,
                };
            }),
            sharedReports: reports.results.map((row) => ({
                pairId: row.pair_id,
                report: JSON.parse(row.report_json) as unknown,
                createdAt: row.created_at,
            })),
        };
    },

    async withdrawFromPair(pairId, userId, withdrawnAt) {
        const role = (await pairRoles(database, userId)).find(
            (candidate) => candidate.pair_id === pairId,
        );
        if (!role) return false;
        await database.batch(
            withdrawalStatements(database, pairId, userId, role.role, withdrawnAt),
        );
        return true;
    },

    async deleteAccount({ userId, deletedAt, tombstoneEmail }) {
        const account = await database
            .prepare(
                `SELECT email FROM user WHERE id = ? AND NOT EXISTS (
                    SELECT 1 FROM account_deletion WHERE user_id = ?
                )`,
            )
            .bind(userId, userId)
            .first<{ email: string }>();
        if (!account) return false;
        await database.batch([
            database
                .prepare(
                    `INSERT OR IGNORE INTO pair_participant_withdrawal
                        (pair_id, role, withdrawn_at)
                     SELECT pair_id,
                            CASE WHEN creator_user_id = ? THEN 'creator' ELSE 'partner' END,
                            ?
                     FROM cofounder_pair
                     WHERE creator_user_id = ? OR partner_user_id = ?`,
                )
                .bind(userId, deletedAt, userId, userId),
            database.prepare('DELETE FROM pair_test WHERE user_id = ?').bind(userId),
            database
                .prepare(
                    `DELETE FROM pair_result WHERE pair_id IN (
                        SELECT pair_id FROM cofounder_pair
                        WHERE creator_user_id = ? OR partner_user_id = ?
                    )`,
                )
                .bind(userId, userId),
            database
                .prepare(
                    `DELETE FROM report_job WHERE pair_id IN (
                        SELECT pair_id FROM cofounder_pair
                        WHERE creator_user_id = ? OR partner_user_id = ?
                    )`,
                )
                .bind(userId, userId),
            database
                .prepare(
                    `DELETE FROM pair_event WHERE pair_id IN (
                        SELECT pair_id FROM cofounder_pair
                        WHERE creator_user_id = ? OR partner_user_id = ?
                    )`,
                )
                .bind(userId, userId),
            database
                .prepare(
                    `UPDATE cofounder_pair
                     SET report_status = 'pending', report_generating_at = NULL,
                         report_ready_at = NULL, invite_token_hash = NULL,
                         invite_created_at = NULL, updated_at = ?
                     WHERE creator_user_id = ? OR partner_user_id = ?`,
                )
                .bind(deletedAt, userId, userId),
            database
                .prepare(
                    `UPDATE public_result SET unpublished_at = ?
                     WHERE unpublished_at IS NULL AND pair_id IN (
                         SELECT pair_id FROM cofounder_pair
                         WHERE creator_user_id = ? OR partner_user_id = ?
                     )`,
                )
                .bind(deletedAt, userId, userId),
            database
                .prepare(
                    `UPDATE public_result_slug SET active = 0 WHERE pair_id IN (
                        SELECT pair_id FROM cofounder_pair
                        WHERE creator_user_id = ? OR partner_user_id = ?
                    )`,
                )
                .bind(userId, userId),
            database
                .prepare('DELETE FROM public_name_permission WHERE user_id = ?')
                .bind(userId),
            database
                .prepare(
                    `INSERT INTO account_deletion (user_id, deleted_at)
                     VALUES (?, ?)`,
                )
                .bind(userId, deletedAt),
            database.prepare('DELETE FROM session WHERE userId = ?').bind(userId),
            database.prepare('DELETE FROM account WHERE userId = ?').bind(userId),
            database
                .prepare('DELETE FROM account_consent WHERE user_id = ?')
                .bind(userId),
            database
                .prepare('DELETE FROM verification WHERE identifier LIKE ?')
                .bind(`%${account.email}%`),
            database
                .prepare('DELETE FROM privacy_action_authorization WHERE user_id = ?')
                .bind(userId),
            database
                .prepare(
                    `UPDATE user SET name = 'Deleted Account', email = ?,
                         emailVerified = 0, image = NULL, updatedAt = ?
                     WHERE id = ?`,
                )
                .bind(tombstoneEmail, deletedAt, userId),
        ]);
        return true;
    },
});
