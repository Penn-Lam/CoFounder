import { describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
    createAbuseRepository,
    evaluateAbuse,
    type AbusePolicy,
    type AbuseRepository,
} from './abuse-controls';

const policy: AbusePolicy = {
    scope: 'otp_email',
    windowSeconds: 3600,
    challengeAfter: 3,
    blockAfter: 10,
    action: 'otp',
};

describe('abuse decisions', () => {
    it('allows through the threshold, then challenges, then blocks', async () => {
        let count = 0;
        const repository: AbuseRepository = {
            increment: async () => ++count,
        };
        const decide = () =>
            evaluateAbuse(
                repository,
                [policy],
                { otp_email: 'founder@example.com' },
                new Date('2026-09-20T12:00:00.000Z'),
            );

        expect(await decide()).toBe('allow');
        expect(await decide()).toBe('allow');
        expect(await decide()).toBe('allow');
        expect(await decide()).toBe('challenge');
        for (let request = 5; request <= 10; request += 1) {
            expect(await decide()).toBe('challenge');
        }
        expect(await decide()).toBe('blocked');
    });

    it('uses independent fixed windows', async () => {
        const sqlite = new Database(':memory:');
        sqlite.exec(`
            CREATE TABLE abuse_window (
                scope TEXT NOT NULL,
                key_hash TEXT NOT NULL,
                window_started_at INTEGER NOT NULL,
                request_count INTEGER NOT NULL,
                PRIMARY KEY (scope, key_hash, window_started_at)
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
                    async first<T>() {
                        return sqlite.query(sql).get(...values) as T | null;
                    },
                };
                return statement;
            },
        } as unknown as D1Database;
        const repository = createAbuseRepository(database);

        expect(
            await repository.increment(
                'otp_ip',
                '203.0.113.10',
                new Date('2026-09-20T12:59:59.999Z'),
                3600,
            ),
        ).toBe(1);
        expect(
            await repository.increment(
                'otp_ip',
                '203.0.113.10',
                new Date('2026-09-20T12:59:59.999Z'),
                3600,
            ),
        ).toBe(2);
        expect(
            await repository.increment(
                'otp_ip',
                '203.0.113.10',
                new Date('2026-09-20T13:00:00.000Z'),
                3600,
            ),
        ).toBe(1);
        sqlite.close();
    });
});
