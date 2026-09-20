import { describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
    createPairLifecycleRepository,
    pairLifecycleCutoffs,
    runPairLifecycle,
    type PairLifecycleRepository,
    type PendingPairEmail,
} from './pair-lifecycle';

const NOW = new Date('2026-09-30T12:00:00.000Z');

type TestStatement = {
    bind(...values: unknown[]): TestStatement;
    all<T>(): Promise<{ results: T[] }>;
    run(): Promise<{ meta: { changes: number } }>;
    execute(): { meta: { changes: number } };
};

const d1Database = (sqlite: Database) => {
    const prepare = (sql: string): TestStatement => {
        let values: unknown[] = [];
        const execute = () => {
            const result = sqlite.query(sql).run(...values);
            return { meta: { changes: result.changes } };
        };
        const statement: TestStatement = {
            bind(...nextValues: unknown[]) {
                values = nextValues;
                return statement;
            },
            async all<T>() {
                return { results: sqlite.query(sql).all(...values) as T[] };
            },
            async run() {
                return execute();
            },
            execute,
        };
        return statement;
    };
    return {
        prepare,
        async batch(statements: TestStatement[]) {
            return sqlite.transaction((batch: TestStatement[]) =>
                batch.map((statement) => statement.execute()),
            )(statements);
        },
    } as unknown as D1Database;
};

const retentionDatabase = () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL);
        CREATE TABLE cofounder_pair (
            pair_id TEXT PRIMARY KEY,
            creator_user_id TEXT NOT NULL,
            partner_user_id TEXT,
            report_status TEXT NOT NULL,
            last_activity_at TEXT NOT NULL
        );
        CREATE TABLE pair_test (
            pair_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            submitted_at TEXT
        );
        CREATE TABLE pair_participant_withdrawal (pair_id TEXT NOT NULL);
        CREATE TABLE pair_event (
            event_id TEXT PRIMARY KEY,
            pair_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            created_at TEXT NOT NULL,
            delivered_at TEXT,
            UNIQUE (pair_id, event_type)
        );
        CREATE TABLE pair_email_delivery (
            event_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            delivered_at TEXT,
            PRIMARY KEY (event_id, user_id)
        );
        CREATE TABLE product_event (
            event_id TEXT PRIMARY KEY,
            pair_id TEXT,
            user_id TEXT,
            event_type TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        INSERT INTO user VALUES ('creator', 'creator@example.com');
    `);
    const insertPair = sqlite.query(
        `INSERT INTO cofounder_pair VALUES (?, 'creator', NULL, 'pending', ?)`,
    );
    for (const [pairId, activity] of [
        ['before-reminder', '2026-09-07T12:00:00.001Z'],
        ['at-reminder', '2026-09-07T12:00:00.000Z'],
        ['before-expiry', '2026-08-31T12:00:00.001Z'],
        ['at-expiry', '2026-08-31T12:00:00.000Z'],
        ['after-expiry', '2026-08-31T11:59:59.999Z'],
    ]) {
        insertPair.run(pairId, activity);
        sqlite
            .query(`INSERT INTO pair_test VALUES (?, 'creator', NULL)`)
            .run(pairId);
    }
    return sqlite;
};

const pendingEmails: PendingPairEmail[] = [
    {
        eventId: 'expiry-reminder:pair-1',
        userId: 'creator',
        email: 'creator@example.com',
        type: 'expiry_reminder',
        expiresAt: '2026-10-07 12:00:00',
    },
    {
        eventId: 'report-ready:pair-2',
        userId: 'partner',
        email: 'partner@example.com',
        type: 'report_ready',
        expiresAt: null,
    },
];

const harness = () => {
    const scheduled: Array<{
        now: string;
        reminderCutoff: string;
        expiryCutoff: string;
    }> = [];
    const delivered: string[] = [];
    const sent: PairEmailType[] = [];
    const pendingCutoffs: string[][] = [];
    let completedAt = '';
    let deletedAt = '';
    const repository: PairLifecycleRepository = {
        async scheduleEmails(input) {
            scheduled.push(input);
        },
        async getPendingEmails(_limit, reminderCutoff, expiryCutoff) {
            pendingCutoffs.push([reminderCutoff, expiryCutoff]);
            return pendingEmails;
        },
        async markEmailDelivered(eventId, userId) {
            delivered.push(`${eventId}:${userId}`);
        },
        async markCompletedEvents(timestamp) {
            completedAt = timestamp;
        },
        async deleteExpired(cutoff) {
            deletedAt = cutoff;
            return 2;
        },
    };

    return {
        repository,
        scheduled,
        delivered,
        sent,
        pendingCutoffs,
        completedAt: () => completedAt,
        deletedAt: () => deletedAt,
    };
};

type PairEmailType = PendingPairEmail['type'];

describe('Pair temporal lifecycle', () => {
    it('places reminder and expiry cutoffs exactly 23 and 30 days before now', () => {
        expect(pairLifecycleCutoffs(NOW)).toEqual({
            reminderCutoff: '2026-09-07T12:00:00.000Z',
            expiryCutoff: '2026-08-31T12:00:00.000Z',
        });
    });

    it('honors both sides of the reminder and expiry boundaries in SQL', async () => {
        const sqlite = retentionDatabase();
        const repository = createPairLifecycleRepository(d1Database(sqlite));
        const cutoffs = pairLifecycleCutoffs(NOW);

        await repository.scheduleEmails({ now: NOW.toISOString(), ...cutoffs });
        await repository.scheduleEmails({ now: NOW.toISOString(), ...cutoffs });
        expect(
            (
                sqlite
                    .query(`SELECT pair_id FROM pair_event ORDER BY pair_id`)
                    .all() as Array<{ pair_id: string }>
            ).map((row) => row.pair_id),
        ).toEqual(['at-reminder', 'before-expiry']);
        expect(
            sqlite
                .query(`SELECT COUNT(*) AS count FROM pair_email_delivery`)
                .get(),
        ).toEqual({ count: 2 });

        sqlite
            .query(
                `UPDATE cofounder_pair SET last_activity_at = ? WHERE pair_id = ?`,
            )
            .run('2026-09-07T12:00:00.001Z', 'at-reminder');
        sqlite
            .query(
                `UPDATE pair_event
                 SET event_type = 'expiry_reminder_cancelled:' ||
                                  substr(event_type, length('expiry_reminder:') + 1)
                 WHERE pair_id = 'at-reminder'`,
            )
            .run();
        expect(
            (
                await repository.getPendingEmails(
                    50,
                    cutoffs.reminderCutoff,
                    cutoffs.expiryCutoff,
                )
            ).map(({ eventId }) => eventId),
        ).toEqual(['expiry-reminder:before-expiry:2026-08-31T12:00:00.001Z']);

        expect(
            await repository.deleteExpired(
                cutoffs.expiryCutoff,
                NOW.toISOString(),
            ),
        ).toBe(2);
        expect(
            (
                sqlite
                    .query(
                        `SELECT pair_id FROM cofounder_pair ORDER BY pair_id`,
                    )
                    .all() as Array<{ pair_id: string }>
            ).map((row) => row.pair_id),
        ).toEqual(['at-reminder', 'before-expiry', 'before-reminder']);
        expect(
            (
                sqlite
                    .query(
                        `SELECT pair_id FROM product_event
                         WHERE event_type = 'pair_expired' ORDER BY pair_id`,
                    )
                    .all() as Array<{ pair_id: string }>
            ).map((row) => row.pair_id),
        ).toEqual(['after-expiry', 'at-expiry']);
        expect(
            sqlite
                .query(
                    `SELECT DISTINCT created_at FROM product_event
                     WHERE event_type = 'pair_expired'`,
                )
                .get(),
        ).toEqual({ created_at: NOW.toISOString() });
        sqlite.close();
    });

    it('sends only the two transactional email types and keeps failures pending', async () => {
        const test = harness();
        const deleted = await runPairLifecycle(
            test.repository,
            async (pending) => {
                test.sent.push(pending.type);
                if (pending.type === 'report_ready')
                    throw new Error('provider unavailable');
            },
            NOW,
        );

        expect(test.scheduled).toEqual([
            {
                now: NOW.toISOString(),
                reminderCutoff: '2026-09-07T12:00:00.000Z',
                expiryCutoff: '2026-08-31T12:00:00.000Z',
            },
        ]);
        expect(test.sent).toEqual(['expiry_reminder', 'report_ready']);
        expect(test.pendingCutoffs).toEqual([
            ['2026-09-07T12:00:00.000Z', '2026-08-31T12:00:00.000Z'],
        ]);
        expect(test.delivered).toEqual(['expiry-reminder:pair-1:creator']);
        expect(test.completedAt()).toBe(NOW.toISOString());
        expect(test.deletedAt()).toBe('2026-08-31T12:00:00.000Z');
        expect(deleted).toBe(2);
    });
});
