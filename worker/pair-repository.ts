import type { PairProfile } from './questionnaire';

export type PairTestState = {
    profile: PairProfile | null;
    answers: Record<string, string>;
};

export type PairTestRecord = {
    pairId: string;
    userId: string;
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

export interface PairRepository {
    create(input: {
        pairId: string;
        userId: string;
        questionSetVersion: string;
        createdAt: string;
    }): Promise<PairTestRecord | null>;
    listActive(userId: string): Promise<PairTestRecord[]>;
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
    ): Promise<PairWriteResult>;
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
};

const toRecord = (row: PairRow): PairTestRecord => ({
    pairId: row.pair_id,
    userId: row.user_id,
    questionSetVersion: row.question_set_version,
    revision: row.revision,
    state: JSON.parse(row.state_json) as PairTestState,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
});

export const createPairRepository = (database: D1Database): PairRepository => {
    const get = async (pairId: string, userId: string) => {
        const row = await database
            .prepare(
                `SELECT pair_id, user_id, question_set_version, revision, state_json,
                        created_at, updated_at, submitted_at
                 FROM pair_test
                 WHERE pair_id = ? AND user_id = ?`,
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

    return {
        async create({ pairId, userId, questionSetVersion, createdAt }) {
            const result = await database
                .prepare(
                    `INSERT INTO pair_test
                        (pair_id, user_id, question_set_version, revision, state_json,
                         created_at, updated_at, submitted_at)
                     SELECT ?, ?, ?, 0, ?, ?, ?, NULL
                     WHERE (
                         SELECT COUNT(*) FROM pair_test
                         WHERE user_id = ? AND submitted_at IS NULL
                     ) < 3`,
                )
                .bind(
                    pairId,
                    userId,
                    questionSetVersion,
                    JSON.stringify({ profile: null, answers: {} }),
                    createdAt,
                    createdAt,
                    userId,
                )
                .run();

            return result.meta.changes === 1 ? get(pairId, userId) : null;
        },
        async listActive(userId) {
            const result = await database
                .prepare(
                    `SELECT pair_id, user_id, question_set_version, revision, state_json,
                            created_at, updated_at, submitted_at
                     FROM pair_test
                     WHERE user_id = ? AND submitted_at IS NULL
                     ORDER BY updated_at DESC`,
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
                       AND submitted_at IS NULL`,
                )
                .bind(
                    JSON.stringify(state),
                    updatedAt,
                    pairId,
                    userId,
                    expectedRevision,
                )
                .run();

            return result.meta.changes === 1
                ? (await get(pairId, userId))!
                : classifyFailedWrite(pairId, userId);
        },
        async submit(pairId, userId, expectedRevision, submittedAt) {
            const result = await database
                .prepare(
                    `UPDATE pair_test
                     SET submitted_at = ?, updated_at = ?, revision = revision + 1
                     WHERE pair_id = ? AND user_id = ? AND revision = ?
                       AND submitted_at IS NULL`,
                )
                .bind(submittedAt, submittedAt, pairId, userId, expectedRevision)
                .run();

            return result.meta.changes === 1
                ? (await get(pairId, userId))!
                : classifyFailedWrite(pairId, userId);
        },
    };
};
