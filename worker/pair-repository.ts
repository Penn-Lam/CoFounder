import type { PairProfile } from './questionnaire';

export type ReportStatus = 'pending' | 'generating' | 'ready';

export type PairTestState = {
    profile: PairProfile | null;
    answers: Record<string, string>;
};

export type PairTestRecord = {
    pairId: string;
    userId: string;
    role: 'creator' | 'partner';
    lifecycle:
        | 'creator_draft'
        | 'waiting_partner'
        | 'partner_in_progress'
        | 'pair_complete'
        | 'report_generating'
        | 'report_ready'
        | 'participant_withdrawn';
    reportStatus: ReportStatus;
    partnerStatus: 'not_started' | 'started' | null;
    invitationStatus: 'unavailable' | 'active' | 'cancelled' | 'claimed';
    questionSetVersion: string;
    revision: number;
    state: PairTestState;
    createdAt: string;
    updatedAt?: string;
    submittedAt: string | null;
};

export type PairWriteResult =
    | PairTestRecord
    | 'not_found'
    | 'sealed'
    | 'conflict';

export type PairInvitation = {
    pairId: string;
    creatorUserId: string;
    creatorDisplayName: string;
};

export type PairClaimResult = PairTestRecord | 'unavailable' | 'same_account';
export type PairInvitationWriteResult =
    | PairTestRecord
    | 'not_found'
    | 'invitation_locked';

export interface PairRepository {
    create(input: {
        pairId: string;
        userId: string;
        questionSetVersion: string;
        createdAt: string;
    }): Promise<PairTestRecord | null>;
    listForUser(userId: string): Promise<PairTestRecord[]>;
    get(pairId: string, userId: string): Promise<PairTestRecord | null>;
    save(
        pairId: string,
        userId: string,
        expectedRevision: number,
        state: PairTestState,
        updatedAt: string,
    ): Promise<PairWriteResult>;
    submit(
        pairId: string,
        userId: string,
        expectedRevision: number,
        submittedAt: string,
        invitationTokenHash?: string,
    ): Promise<PairWriteResult>;
    findInvitation(tokenHash: string): Promise<PairInvitation | null>;
    claimInvitation(
        tokenHash: string,
        userId: string,
        claimedAt: string,
    ): Promise<PairClaimResult>;
    resetInvitation(
        pairId: string,
        userId: string,
        tokenHash: string,
        updatedAt: string,
    ): Promise<PairInvitationWriteResult>;
    cancelInvitation(
        pairId: string,
        userId: string,
        updatedAt: string,
    ): Promise<PairInvitationWriteResult>;
}

type PairRow = {
    pair_id: string;
    user_id: string;
    question_set_version: string;
    revision: number;
    state_json: string;
    created_at: string;
    updated_at: string;
    submitted_at: string | null;
    creator_user_id: string;
    partner_user_id: string | null;
    invite_token_hash: string | null;
    claimed_at: string | null;
    partner_state_json: string | null;
    partner_submitted_at: string | null;
    report_status: ReportStatus;
    counterpart_withdrawn: number;
};

const toRecord = (row: PairRow): PairTestRecord => {
    const role = row.user_id === row.creator_user_id ? 'creator' : 'partner';
    const partnerState = row.partner_state_json
        ? (JSON.parse(row.partner_state_json) as PairTestState)
        : null;
    const partnerStarted = Boolean(
        partnerState &&
            (partnerState.profile || Object.keys(partnerState.answers).length > 0),
    );
    const lifecycle = row.counterpart_withdrawn === 1
        ? 'participant_withdrawn'
        : row.report_status === 'ready'
        ? 'report_ready'
        : row.report_status === 'generating'
          ? 'report_generating'
          : !row.submitted_at && role === 'creator'
            ? 'creator_draft'
            : !row.partner_user_id || !partnerStarted
              ? 'waiting_partner'
              : row.partner_submitted_at
                ? 'pair_complete'
                : 'partner_in_progress';

    return {
        pairId: row.pair_id,
        userId: row.user_id,
        role,
        lifecycle,
        reportStatus: row.report_status,
        partnerStatus:
            role === 'creator' && row.partner_user_id
                ? partnerStarted
                    ? 'started'
                    : 'not_started'
                : null,
        invitationStatus: row.counterpart_withdrawn === 1
            ? 'unavailable'
            : row.claimed_at
            ? 'claimed'
            : !row.submitted_at
              ? 'unavailable'
              : row.invite_token_hash
                ? 'active'
                : 'cancelled',
        questionSetVersion: row.question_set_version,
        revision: row.revision,
        state: JSON.parse(row.state_json) as PairTestState,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        submittedAt: row.submitted_at,
    };
};

const pairSelect = `SELECT pt.pair_id, pt.user_id, pt.question_set_version, pt.revision,
                            pt.state_json, pt.created_at, pt.updated_at, pt.submitted_at,
                            pair.creator_user_id, pair.partner_user_id,
                            pair.invite_token_hash, pair.claimed_at, pair.report_status,
                            CASE WHEN counterpart_withdrawal.role IS NULL THEN 0 ELSE 1 END
                                AS counterpart_withdrawn,
                            partner_test.state_json AS partner_state_json,
                            partner_test.submitted_at AS partner_submitted_at
                     FROM pair_test pt
                     JOIN cofounder_pair pair ON pair.pair_id = pt.pair_id
                     LEFT JOIN pair_test partner_test
                       ON partner_test.pair_id = pair.pair_id
                      AND partner_test.user_id = pair.partner_user_id
                     LEFT JOIN pair_participant_withdrawal counterpart_withdrawal
                       ON counterpart_withdrawal.pair_id = pair.pair_id
                      AND counterpart_withdrawal.role = CASE
                          WHEN pt.user_id = pair.creator_user_id THEN 'partner'
                          ELSE 'creator'
                      END`;

export const createPairRepository = (database: D1Database): PairRepository => {
    const get = async (pairId: string, userId: string) => {
        const row = await database
            .prepare(
                `${pairSelect}
                 WHERE pt.pair_id = ? AND pt.user_id = ?`,
            )
            .bind(pairId, userId)
            .first<PairRow>();

        return row ? toRecord(row) : null;
    };

    const classifyFailedWrite = async (pairId: string, userId: string) => {
        const current = await get(pairId, userId);
        if (!current) return 'not_found' as const;
        return current.submittedAt ? ('sealed' as const) : ('conflict' as const);
    };

    const findInvitation = (tokenHash: string) =>
        database
            .prepare(
                `SELECT pair.pair_id AS pairId,
                        pair.creator_user_id AS creatorUserId,
                        creator.name AS creatorDisplayName
                 FROM cofounder_pair pair
                 JOIN user creator ON creator.id = pair.creator_user_id
                 JOIN pair_test creator_test
                   ON creator_test.pair_id = pair.pair_id
                  AND creator_test.user_id = pair.creator_user_id
                 WHERE pair.invite_token_hash = ?
                   AND pair.partner_user_id IS NULL
                   AND NOT EXISTS (
                       SELECT 1 FROM pair_participant_withdrawal
                       WHERE pair_id = pair.pair_id
                   )
                   AND creator_test.submitted_at IS NOT NULL`,
            )
            .bind(tokenHash)
            .first<PairInvitation>();

    return {
        async create({ pairId, userId, questionSetVersion, createdAt }) {
            const results = await database.batch([
                database
                    .prepare(
                        `INSERT INTO cofounder_pair
                            (pair_id, creator_user_id, created_at, updated_at)
                         SELECT ?, ?, ?, ?
                         WHERE (
                             SELECT COUNT(*)
                             FROM cofounder_pair pair
                             WHERE pair.creator_user_id = ?
                               AND NOT EXISTS (
                                   SELECT 1 FROM pair_test partner_test
                                   WHERE partner_test.pair_id = pair.pair_id
                                     AND partner_test.user_id = pair.partner_user_id
                                     AND partner_test.submitted_at IS NOT NULL
                               )
                         ) < 3`,
                    )
                    .bind(pairId, userId, createdAt, createdAt, userId),
                database
                    .prepare(
                        `INSERT INTO pair_test
                        (pair_id, user_id, question_set_version, revision, state_json,
                         created_at, updated_at, submitted_at)
                     SELECT ?, ?, ?, 0, ?, ?, ?, NULL
                     WHERE EXISTS (
                         SELECT 1 FROM cofounder_pair
                         WHERE pair_id = ? AND creator_user_id = ?
                     )`,
                    )
                    .bind(
                        pairId,
                        userId,
                        questionSetVersion,
                        JSON.stringify({ profile: null, answers: {} }),
                        createdAt,
                        createdAt,
                        pairId,
                        userId,
                    ),
            ]);

            return results[0].meta.changes === 1
                ? get(pairId, userId)
                : null;
        },
        async listForUser(userId) {
            const result = await database
                .prepare(
                    `${pairSelect}
                     WHERE pt.user_id = ?
                     ORDER BY pt.updated_at DESC`,
                )
                .bind(userId)
                .all<PairRow>();

            return result.results.map(toRecord);
        },
        get,
        async save(pairId, userId, expectedRevision, state, updatedAt) {
            const result = await database
                .prepare(
                    `UPDATE pair_test
                     SET state_json = ?, revision = revision + 1, updated_at = ?
                     WHERE pair_id = ? AND user_id = ? AND revision = ?
                       AND submitted_at IS NULL
                       AND NOT EXISTS (
                           SELECT 1 FROM pair_participant_withdrawal
                           WHERE pair_id = ?
                       )`,
                )
                .bind(
                    JSON.stringify(state),
                    updatedAt,
                    pairId,
                    userId,
                    expectedRevision,
                    pairId,
                )
                .run();

            return result.meta.changes === 1
                ? (await get(pairId, userId))!
                : classifyFailedWrite(pairId, userId);
        },
        async submit(
            pairId,
            userId,
            expectedRevision,
            submittedAt,
            invitationTokenHash,
        ) {
            const updateTest = database
                .prepare(
                    `UPDATE pair_test
                     SET submitted_at = ?, updated_at = ?, revision = revision + 1
                     WHERE pair_id = ? AND user_id = ? AND revision = ?
                       AND submitted_at IS NULL
                       AND NOT EXISTS (
                           SELECT 1 FROM pair_participant_withdrawal
                           WHERE pair_id = ?
                       )`,
                )
                .bind(submittedAt, submittedAt, pairId, userId, expectedRevision, pairId);
            const updatePair = invitationTokenHash
                ? database
                      .prepare(
                          `UPDATE cofounder_pair
                           SET invite_token_hash = ?, invite_created_at = ?, updated_at = ?
                           WHERE pair_id = ? AND creator_user_id = ?
                             AND partner_user_id IS NULL
                             AND claimed_at IS NULL
                             AND invite_token_hash IS NULL
                             AND EXISTS (
                                 SELECT 1 FROM pair_test
                                 WHERE pair_id = ? AND user_id = ?
                                   AND revision = ? AND submitted_at = ?
                             )`,
                      )
                      .bind(
                          invitationTokenHash,
                          submittedAt,
                          submittedAt,
                          pairId,
                          userId,
                          pairId,
                          userId,
                          expectedRevision + 1,
                          submittedAt,
                      )
                : database
                      .prepare(
                          `UPDATE cofounder_pair
                           SET updated_at = ?
                           WHERE pair_id = ? AND partner_user_id = ?
                             AND EXISTS (
                                 SELECT 1 FROM pair_test
                                 WHERE pair_id = ? AND user_id = ?
                                   AND revision = ? AND submitted_at = ?
                             )`,
                      )
                      .bind(
                          submittedAt,
                          pairId,
                          userId,
                          pairId,
                          userId,
                          expectedRevision + 1,
                          submittedAt,
                      );
            const beginReport = database
                .prepare(
                    `UPDATE cofounder_pair
                     SET report_status = 'generating', report_generating_at = ?, updated_at = ?
                     WHERE pair_id = ? AND report_status = 'pending'
                       AND partner_user_id IS NOT NULL
                       AND (SELECT COUNT(*) FROM pair_test
                            WHERE pair_id = ? AND submitted_at IS NOT NULL) = 2
                       AND (SELECT COUNT(DISTINCT question_set_version) FROM pair_test
                            WHERE pair_id = ?) = 1`,
                )
                .bind(submittedAt, submittedAt, pairId, pairId, pairId);
            const enqueueReport = database
                .prepare(
                    `INSERT OR IGNORE INTO report_job (pair_id, created_at)
                     SELECT pair_id, ? FROM cofounder_pair
                     WHERE pair_id = ? AND report_status = 'generating'`,
                )
                .bind(submittedAt, pairId);
            const results = await database.batch([
                updateTest,
                updatePair,
                beginReport,
                enqueueReport,
            ]);

            return results[0].meta.changes === 1
                ? (await get(pairId, userId))!
                : classifyFailedWrite(pairId, userId);
        },
        findInvitation,
        async claimInvitation(tokenHash, userId, claimedAt) {
            const invitation = await findInvitation(tokenHash);
            if (!invitation) return 'unavailable';
            if (invitation.creatorUserId === userId) return 'same_account';

            const results = await database.batch([
                database
                    .prepare(
                        `UPDATE cofounder_pair
                         SET partner_user_id = ?, claimed_at = ?, updated_at = ?
                         WHERE invite_token_hash = ? AND partner_user_id IS NULL
                           AND claimed_at IS NULL
                             AND creator_user_id <> ?
                             AND NOT EXISTS (
                                 SELECT 1 FROM pair_participant_withdrawal
                                 WHERE pair_id = cofounder_pair.pair_id
                             )`,
                    )
                    .bind(userId, claimedAt, claimedAt, tokenHash, userId),
                database
                    .prepare(
                        `INSERT INTO pair_test
                            (pair_id, user_id, question_set_version, revision, state_json,
                             created_at, updated_at, submitted_at)
                         SELECT pair.pair_id, ?, creator_test.question_set_version, 0, ?, ?, ?, NULL
                         FROM cofounder_pair pair
                         JOIN pair_test creator_test
                           ON creator_test.pair_id = pair.pair_id
                          AND creator_test.user_id = pair.creator_user_id
                         WHERE pair.pair_id = ? AND pair.partner_user_id = ?
                           AND pair.invite_token_hash = ?`,
                    )
                    .bind(
                        userId,
                        JSON.stringify({ profile: null, answers: {} }),
                        claimedAt,
                        claimedAt,
                        invitation.pairId,
                        userId,
                        tokenHash,
                    ),
                database
                    .prepare(
                        `UPDATE cofounder_pair
                         SET invite_token_hash = NULL
                         WHERE pair_id = ? AND partner_user_id = ?
                           AND invite_token_hash = ?`,
                    )
                    .bind(invitation.pairId, userId, tokenHash),
            ]);

            return results[0].meta.changes === 1
                ? (await get(invitation.pairId, userId))!
                : 'unavailable';
        },
        async resetInvitation(pairId, userId, tokenHash, updatedAt) {
            const result = await database
                .prepare(
                    `UPDATE cofounder_pair
                     SET invite_token_hash = ?, invite_created_at = ?, updated_at = ?
                     WHERE pair_id = ? AND creator_user_id = ?
                       AND partner_user_id IS NULL
                       AND claimed_at IS NULL
                       AND NOT EXISTS (
                           SELECT 1 FROM pair_participant_withdrawal
                           WHERE pair_id = cofounder_pair.pair_id
                       )
                       AND EXISTS (
                           SELECT 1 FROM pair_test
                           WHERE pair_id = ? AND user_id = ?
                             AND submitted_at IS NOT NULL
                       )`,
                )
                .bind(
                    tokenHash,
                    updatedAt,
                    updatedAt,
                    pairId,
                    userId,
                    pairId,
                    userId,
                )
                .run();
            if (result.meta.changes === 1) return (await get(pairId, userId))!;
            return (await get(pairId, userId)) ? 'invitation_locked' : 'not_found';
        },
        async cancelInvitation(pairId, userId, updatedAt) {
            const result = await database
                .prepare(
                    `UPDATE cofounder_pair
                     SET invite_token_hash = NULL, invite_created_at = NULL, updated_at = ?
                     WHERE pair_id = ? AND creator_user_id = ?
                       AND partner_user_id IS NULL
                       AND claimed_at IS NULL
                       AND NOT EXISTS (
                           SELECT 1 FROM pair_participant_withdrawal
                           WHERE pair_id = cofounder_pair.pair_id
                       )
                       AND EXISTS (
                           SELECT 1 FROM pair_test
                           WHERE pair_id = ? AND user_id = ?
                             AND submitted_at IS NOT NULL
                       )`,
                )
                .bind(updatedAt, pairId, userId, pairId, userId)
                .run();
            if (result.meta.changes === 1) return (await get(pairId, userId))!;
            return (await get(pairId, userId)) ? 'invitation_locked' : 'not_found';
        },
    };
};
