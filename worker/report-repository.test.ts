import { describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
    createReportRepository,
    type PrivateReportFacts,
    type StoredPairResult,
} from './report-repository';

type TestStatement = {
    bind(...values: unknown[]): TestStatement;
    all<T>(): Promise<{ results: T[] }>;
    first<T>(): Promise<T | null>;
    run(): Promise<{ meta: { changes: number } }>;
    execute(): { meta: { changes: number } };
};

const d1Database = (sqlite: Database) => {
    const prepare = (sql: string): TestStatement => {
        let values: unknown[] = [];
        const statement: TestStatement = {
            bind(...nextValues) {
                values = nextValues;
                return statement;
            },
            async all<T>() {
                return { results: sqlite.query(sql).all(...values) as T[] };
            },
            async first<T>() {
                return sqlite.query(sql).get(...values) as T | null;
            },
            async run() {
                return statement.execute();
            },
            execute() {
                const result = sqlite.query(sql).run(...values);
                return { meta: { changes: result.changes } };
            },
        };
        return statement;
    };
    return {
        prepare,
        async batch(statements: TestStatement[]) {
            return sqlite.transaction((items: TestStatement[]) =>
                items.map((statement) => statement.execute()),
            )(statements);
        },
    } as unknown as D1Database;
};

const database = () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE cofounder_pair (
            pair_id TEXT PRIMARY KEY,
            report_status TEXT NOT NULL,
            report_generating_at TEXT,
            report_ready_at TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE pair_test (
            pair_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            state_json TEXT NOT NULL,
            PRIMARY KEY (pair_id, user_id)
        );
        CREATE TABLE pair_result (
            pair_id TEXT PRIMARY KEY REFERENCES cofounder_pair(pair_id),
            question_set_version TEXT NOT NULL,
            rules_version TEXT NOT NULL,
            content_version TEXT NOT NULL,
            report_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE pair_event (
            event_id TEXT PRIMARY KEY,
            pair_id TEXT NOT NULL REFERENCES cofounder_pair(pair_id),
            event_type TEXT NOT NULL,
            created_at TEXT NOT NULL,
            delivered_at TEXT,
            UNIQUE (pair_id, event_type)
        );
        INSERT INTO cofounder_pair VALUES (
            'pair-1', 'generating', '2026-09-20T12:00:00.000Z', NULL,
            '2026-09-20T12:00:00.000Z'
        );
    `);
    const state = JSON.stringify({
        profile: { responsibilities: ['product'] },
        answers: {
            'core:Q1': 'A',
            'core:Q2': 'B',
            'mirror:Q1': 'C',
            'red-line:R1': 'A',
            'red-line:R2': 'B',
            'red-line:R3': 'C',
            'red-line:R4': 'D',
        },
    });
    sqlite
        .query(`INSERT INTO pair_test VALUES ('pair-1', ?, ?)`)
        .run('creator', state);
    sqlite
        .query(`INSERT INTO pair_test VALUES ('pair-1', ?, ?)`)
        .run('partner', state);
    return sqlite;
};

const result: StoredPairResult = {
    pairId: 'pair-1',
    questionSetVersion: 'questions-v1',
    rulesVersion: 'rules-v1',
    contentVersion: 'content-v1',
    report: { disclaimer: { id: 'disclaimer', copy: 'Entertainment only.' } } as PrivateReportFacts,
    createdAt: '2026-09-20T12:05:00.000Z',
};

describe('report result transaction', () => {
    it('rolls back the result if sensitive-answer deletion cannot commit', async () => {
        const sqlite = database();
        try {
            sqlite.exec(`
                CREATE TRIGGER reject_report_event
                BEFORE INSERT ON pair_event
                BEGIN
                    SELECT RAISE(ABORT, 'event unavailable');
                END;
            `);
            const repository = createReportRepository(d1Database(sqlite));

            await expect(repository.commitResult(result)).rejects.toThrow('event unavailable');
            expect(sqlite.query(`SELECT COUNT(*) AS count FROM pair_result`).get()).toEqual({
                count: 0,
            });
            for (const row of sqlite
                .query(`SELECT state_json FROM pair_test ORDER BY user_id`)
                .all() as Array<{ state_json: string }>) {
                const answers = JSON.parse(row.state_json).answers as Record<string, string>;
                expect(answers['core:Q1']).toBe('A');
                expect(answers['mirror:Q1']).toBe('C');
                expect(answers['red-line:R4']).toBe('D');
            }
            expect(
                sqlite.query(`SELECT report_status FROM cofounder_pair`).get(),
            ).toEqual({ report_status: 'generating' });
        } finally {
            sqlite.close();
        }
    });

    it('atomically deletes sensitive answers and is idempotent on duplicate commits', async () => {
        const sqlite = database();
        try {
            const repository = createReportRepository(d1Database(sqlite));

            const first = await repository.commitResult(result);
            const duplicate = await repository.commitResult(result);
            expect(duplicate).toEqual(first);
            expect(sqlite.query(`SELECT COUNT(*) AS count FROM pair_result`).get()).toEqual({
                count: 1,
            });
            expect(sqlite.query(`SELECT COUNT(*) AS count FROM pair_event`).get()).toEqual({
                count: 1,
            });
            for (const row of sqlite
                .query(`SELECT state_json FROM pair_test ORDER BY user_id`)
                .all() as Array<{ state_json: string }>) {
                const answers = JSON.parse(row.state_json).answers as Record<string, string>;
                expect(answers['core:Q2']).toBe('B');
                expect(answers['core:Q1']).toBeUndefined();
                expect(answers['mirror:Q1']).toBeUndefined();
                for (const id of ['R1', 'R2', 'R3', 'R4']) {
                    expect(answers[`red-line:${id}`]).toBeUndefined();
                }
            }
            expect(
                sqlite.query(`SELECT report_status FROM cofounder_pair`).get(),
            ).toEqual({ report_status: 'ready' });
        } finally {
            sqlite.close();
        }
    });
});
