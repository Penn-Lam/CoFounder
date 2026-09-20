import type { PairTestState } from './pair-repository';

export type StoredPairResult = {
    pairId: string;
    questionSetVersion: string;
    rulesVersion: string;
    contentVersion: string;
    report: PrivateReportFacts;
    createdAt: string;
};

export type ReportParticipantInput = {
    userId: string;
    questionSetVersion: string;
    state: PairTestState;
    submittedAt: string;
};

export type ReportInput = {
    pairId: string;
    creator: ReportParticipantInput;
    partner: ReportParticipantInput;
};

export type ReportDimension = {
    dimension: string;
    label: string;
    participantBands: { a: number; b: number };
    bandContent: {
        a: { label: string; copy: string };
        b: { label: string; copy: string };
    };
    match: number;
    relation: string;
    relationLabel: string;
};

export type PrivateReportFacts = {
    versions: { questionSet: string; rules: string; content: string };
    roles: { a: 'creator'; b: 'partner' };
    portrait: {
        archetypeId: string;
        title: string;
        englishTitle: string;
        copy: string;
    };
    alignment: {
        dimension: string;
        moduleId: string;
        title: string;
        copy: string;
    };
    complement: {
        dimension: string;
        moduleId: string;
        title: string;
        copy: string;
    };
    sections: Record<
        'topDifference' | 'dimensions' | 'mirror' | 'flags' | 'prompts',
        { title: string; copy: string }
    >;
    topRisk: {
        kind: 'flag' | 'unresolved' | 'difference';
        id: string;
        severity: string | null;
        title: string;
        copy: string;
    };
    privatePattern: { id: string; title: string; copy: string; action: string };
    dimensions: ReportDimension[];
    mirror: {
        aPredictsB: { exact: number; near: number; opposite: number };
        bPredictsA: { exact: number; near: number; opposite: number };
    };
    conflictFlags: Array<{
        id: string;
        title: string;
        copy: string;
        severity: string;
        severityLabel: string;
        dimension: string;
        dimensionLabel: string;
    }>;
    sensitiveContext: {
        attribution: 'unattributed';
        signals: Array<{
            topic: string;
            topicLabel: string;
            state: string;
            stateLabel: string;
            severity: string | null;
            severityLabel: string | null;
            ruleVersion: string;
        }>;
        unresolvedTopics: string[];
    };
    prompts: Array<{ id: string; copy: string }>;
    disclaimer: { id: string; copy: string };
};

export interface ReportRepository {
    getResult(pairId: string): Promise<StoredPairResult | null>;
    getInput(pairId: string): Promise<ReportInput | null>;
    commitResult(result: StoredPairResult): Promise<StoredPairResult>;
    getPendingJobs(
        limit: number,
        retryBefore: string,
        pairId?: string,
    ): Promise<string[]>;
    markJobDispatched(pairId: string, dispatchedAt: string): Promise<void>;
    markJobCompleted(pairId: string, completedAt: string): Promise<void>;
}

type ResultRow = {
    pair_id: string;
    question_set_version: string;
    rules_version: string;
    content_version: string;
    report_json: string;
    created_at: string;
};

const toResult = (row: ResultRow): StoredPairResult => ({
    pairId: row.pair_id,
    questionSetVersion: row.question_set_version,
    rulesVersion: row.rules_version,
    contentVersion: row.content_version,
    report: JSON.parse(row.report_json) as PrivateReportFacts,
    createdAt: row.created_at,
});

export const createReportRepository = (
    database: D1Database,
): ReportRepository => {
    const getResult = async (pairId: string) => {
        const row = await database
            .prepare(`SELECT * FROM pair_result WHERE pair_id = ?`)
            .bind(pairId)
            .first<ResultRow>();
        return row ? toResult(row) : null;
    };

    return {
        getResult,
        async getPendingJobs(limit, retryBefore, pairId) {
            const result = pairId
                ? await database
                      .prepare(
                          `SELECT pair_id FROM report_job
                           WHERE pair_id = ? AND dispatched_at IS NULL
                             AND completed_at IS NULL
                           LIMIT ?`,
                      )
                      .bind(pairId, limit)
                      .all<{ pair_id: string }>()
                : await database
                      .prepare(
                          `SELECT pair_id FROM report_job
                           WHERE completed_at IS NULL
                             AND (dispatched_at IS NULL OR dispatched_at <= ?)
                           ORDER BY created_at
                           LIMIT ?`,
                      )
                      .bind(retryBefore, limit)
                      .all<{ pair_id: string }>();
            return result.results.map(({ pair_id }) => pair_id);
        },
        async markJobDispatched(pairId, dispatchedAt) {
            await database
                .prepare(
                    `UPDATE report_job SET dispatched_at = ?
                     WHERE pair_id = ? AND completed_at IS NULL`,
                )
                .bind(dispatchedAt, pairId)
                .run();
        },
        async markJobCompleted(pairId, completedAt) {
            await database
                .prepare(
                    `UPDATE report_job SET completed_at = ? WHERE pair_id = ?`,
                )
                .bind(completedAt, pairId)
                .run();
        },
        async getInput(pairId) {
            const pair = await database
                .prepare(
                    `SELECT creator_user_id, partner_user_id
                     FROM cofounder_pair
                     WHERE pair_id = ? AND report_status = 'generating'
                       AND partner_user_id IS NOT NULL`,
                )
                .bind(pairId)
                .first<{ creator_user_id: string; partner_user_id: string }>();
            if (!pair) return null;

            const tests = await database
                .prepare(
                    `SELECT user_id, question_set_version, state_json, submitted_at
                     FROM pair_test
                     WHERE pair_id = ? AND submitted_at IS NOT NULL`,
                )
                .bind(pairId)
                .all<{
                    user_id: string;
                    question_set_version: string;
                    state_json: string;
                    submitted_at: string;
                }>();
            const byUser = new Map(
                tests.results.map((row) => [row.user_id, row]),
            );
            const creator = byUser.get(pair.creator_user_id);
            const partner = byUser.get(pair.partner_user_id);
            if (
                !creator ||
                !partner ||
                creator.question_set_version !== partner.question_set_version
            ) {
                return null;
            }
            const mapParticipant = (
                row: typeof creator,
            ): ReportParticipantInput => ({
                userId: row.user_id,
                questionSetVersion: row.question_set_version,
                state: JSON.parse(row.state_json) as PairTestState,
                submittedAt: row.submitted_at,
            });
            return {
                pairId,
                creator: mapParticipant(creator),
                partner: mapParticipant(partner),
            };
        },
        async commitResult(result) {
            const sensitivePaths = [
                '$.answers."core:Q1"',
                '$.answers."mirror:Q1"',
                '$.answers."red-line:R1"',
                '$.answers."red-line:R2"',
                '$.answers."red-line:R3"',
                '$.answers."red-line:R4"',
            ];
            await database.batch([
                database
                    .prepare(
                        `INSERT OR IGNORE INTO pair_result
                            (pair_id, question_set_version, rules_version, content_version,
                             report_json, created_at)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(
                        result.pairId,
                        result.questionSetVersion,
                        result.rulesVersion,
                        result.contentVersion,
                        JSON.stringify(result.report),
                        result.createdAt,
                    ),
                database
                    .prepare(
                        `UPDATE pair_test
                         SET state_json = json_remove(state_json, ?, ?, ?, ?, ?, ?)
                         WHERE pair_id = ?
                           AND EXISTS (SELECT 1 FROM pair_result WHERE pair_id = ?)`,
                    )
                    .bind(...sensitivePaths, result.pairId, result.pairId),
                database
                    .prepare(
                        `UPDATE cofounder_pair
                         SET report_status = 'ready',
                             report_ready_at = (SELECT created_at FROM pair_result WHERE pair_id = ?),
                             updated_at = (SELECT created_at FROM pair_result WHERE pair_id = ?)
                         WHERE pair_id = ? AND report_status = 'generating'
                           AND EXISTS (SELECT 1 FROM pair_result WHERE pair_id = ?)`,
                    )
                    .bind(
                        result.pairId,
                        result.pairId,
                        result.pairId,
                        result.pairId,
                    ),
                database
                    .prepare(
                        `INSERT OR IGNORE INTO pair_event
                            (event_id, pair_id, event_type, created_at)
                         SELECT ?, ?, 'report_ready', created_at
                         FROM pair_result
                         WHERE pair_id = ?`,
                    )
                    .bind(
                        `report-ready:${result.pairId}`,
                        result.pairId,
                        result.pairId,
                    ),
            ]);
            const stored = await getResult(result.pairId);
            if (!stored)
                throw new Error('Report result transaction did not persist');
            return stored;
        },
    };
};
