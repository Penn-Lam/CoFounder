import { describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createProductAnalyticsRepository } from './product-analytics';

describe('authoritative product analytics', () => {
    it('counts a qualifying Pair share only once', async () => {
        const sqlite = new Database(':memory:');
        sqlite.exec(`
            CREATE TABLE product_event (
                event_id TEXT PRIMARY KEY,
                pair_id TEXT,
                user_id TEXT,
                event_type TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        `);
        const database = {
            prepare(sql: string) {
                let values: unknown[] = [];
                const statement = {
                    bind(...next: unknown[]) {
                        values = next;
                        return statement;
                    },
                    async run() {
                        const result = sqlite.query(sql).run(...values);
                        return { meta: { changes: result.changes } };
                    },
                };
                return statement;
            },
        } as unknown as D1Database;
        const analytics = createProductAnalyticsRepository(database);
        const share = {
            eventId: 'pair_shared:pair-1',
            pairId: 'pair-1',
            type: 'pair_shared' as const,
            createdAt: '2026-09-20T12:00:00.000Z',
        };

        expect(await analytics.record(share)).toBe(true);
        expect(await analytics.record(share)).toBe(false);
        expect(
            sqlite
                .query(
                    `SELECT COUNT(*) AS count FROM product_event
                     WHERE pair_id = 'pair-1' AND event_type = 'pair_shared'`,
                )
                .get() as { count: number },
        ).toEqual({ count: 1 });
        sqlite.close();
    });
});
