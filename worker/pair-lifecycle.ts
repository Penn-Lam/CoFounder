import type { AuthBindings } from './auth';
import { sendEmail } from './email-delivery';
import { renderPairEmail, type PairEmailType } from './pair-email-template';

const DAY_MS = 24 * 60 * 60 * 1000;
export const PAIR_EXPIRY_DAYS = 30;
export const PAIR_REMINDER_DAYS_BEFORE_EXPIRY = 7;

export type PendingPairEmail = {
    eventId: string;
    userId: string;
    email: string;
    type: PairEmailType;
    expiresAt: string | null;
};

export interface PairLifecycleRepository {
    scheduleEmails(input: {
        now: string;
        reminderCutoff: string;
        expiryCutoff: string;
    }): Promise<void>;
    getPendingEmails(
        limit: number,
        reminderCutoff: string,
        expiryCutoff: string,
    ): Promise<PendingPairEmail[]>;
    markEmailDelivered(
        eventId: string,
        userId: string,
        deliveredAt: string,
    ): Promise<void>;
    markCompletedEvents(deliveredAt: string): Promise<void>;
    deleteExpired(expiryCutoff: string, expiredAt: string): Promise<number>;
}

export const pairLifecycleCutoffs = (now: Date) => ({
    reminderCutoff: new Date(
        now.getTime() -
            (PAIR_EXPIRY_DAYS - PAIR_REMINDER_DAYS_BEFORE_EXPIRY) * DAY_MS,
    ).toISOString(),
    expiryCutoff: new Date(
        now.getTime() - PAIR_EXPIRY_DAYS * DAY_MS,
    ).toISOString(),
});

export const createPairLifecycleRepository = (
    database: D1Database,
): PairLifecycleRepository => ({
    async scheduleEmails({ now, reminderCutoff, expiryCutoff }) {
        await database.batch([
            database
                .prepare(
                    `INSERT OR IGNORE INTO pair_event
                        (event_id, pair_id, event_type, created_at)
                     SELECT 'expiry-reminder:' || pair.pair_id || ':' || pair.last_activity_at,
                            pair.pair_id,
                            'expiry_reminder:' || pair.last_activity_at, ?
                     FROM cofounder_pair pair
                     WHERE pair.last_activity_at <= ? AND pair.last_activity_at > ?
                       AND pair.report_status <> 'ready'
                       AND (SELECT COUNT(*) FROM pair_test
                            WHERE pair_id = pair.pair_id AND submitted_at IS NOT NULL) < 2
                       AND NOT EXISTS (SELECT 1 FROM pair_participant_withdrawal
                                       WHERE pair_id = pair.pair_id)`,
                )
                .bind(now, reminderCutoff, expiryCutoff),
            database
                .prepare(
                    `INSERT OR IGNORE INTO pair_email_delivery
                        (event_id, user_id, created_at)
                     SELECT event.event_id, participant.user_id, ?
                     FROM pair_event event
                     JOIN cofounder_pair pair ON pair.pair_id = event.pair_id
                     JOIN (
                         SELECT pair_id, creator_user_id AS user_id FROM cofounder_pair
                         UNION ALL
                         SELECT pair_id, partner_user_id AS user_id FROM cofounder_pair
                         WHERE partner_user_id IS NOT NULL
                     ) participant ON participant.pair_id = pair.pair_id
                     WHERE (event.event_type = 'report_ready'
                            OR event.event_type LIKE 'expiry_reminder:%')
                       AND event.delivered_at IS NULL`,
                )
                .bind(now),
        ]);
    },
    async getPendingEmails(limit, reminderCutoff, expiryCutoff) {
        const result = await database
            .prepare(
                `SELECT delivery.event_id, delivery.user_id, user.email,
                        CASE WHEN event.event_type LIKE 'expiry_reminder:%'
                             THEN 'expiry_reminder' ELSE 'report_ready' END AS event_type,
                        CASE WHEN event.event_type LIKE 'expiry_reminder:%'
                             THEN datetime(pair.last_activity_at, '+30 days')
                             ELSE NULL END AS expires_at
                 FROM pair_email_delivery delivery
                 JOIN pair_event event ON event.event_id = delivery.event_id
                 JOIN cofounder_pair pair ON pair.pair_id = event.pair_id
                 JOIN user ON user.id = delivery.user_id
                 WHERE delivery.delivered_at IS NULL
                   AND (event.event_type = 'report_ready'
                        OR (event.event_type LIKE 'expiry_reminder:%'
                            AND pair.last_activity_at <= ?
                            AND pair.last_activity_at > ?))
                 ORDER BY delivery.created_at
                 LIMIT ?`,
            )
            .bind(reminderCutoff, expiryCutoff, limit)
            .all<{
                event_id: string;
                user_id: string;
                email: string;
                event_type: PairEmailType;
                expires_at: string | null;
            }>();
        return result.results.map((row) => ({
            eventId: row.event_id,
            userId: row.user_id,
            email: row.email,
            type: row.event_type,
            expiresAt: row.expires_at,
        }));
    },
    async markEmailDelivered(eventId, userId, deliveredAt) {
        await database
            .prepare(
                `UPDATE pair_email_delivery
                 SET delivered_at = ?
                 WHERE event_id = ? AND user_id = ? AND delivered_at IS NULL`,
            )
            .bind(deliveredAt, eventId, userId)
            .run();
    },
    async markCompletedEvents(deliveredAt) {
        await database
            .prepare(
                `UPDATE pair_event SET delivered_at = ?
                 WHERE (event_type = 'report_ready'
                        OR event_type LIKE 'expiry_reminder:%')
                   AND delivered_at IS NULL
                   AND EXISTS (SELECT 1 FROM pair_email_delivery
                               WHERE event_id = pair_event.event_id)
                   AND NOT EXISTS (SELECT 1 FROM pair_email_delivery
                                   WHERE event_id = pair_event.event_id
                                     AND delivered_at IS NULL)`,
            )
            .bind(deliveredAt)
            .run();
    },
    async deleteExpired(expiryCutoff, expiredAt) {
        const [, result] = await database.batch([
            database
                .prepare(
                    `INSERT OR IGNORE INTO product_event
                        (event_id, pair_id, user_id, event_type, created_at)
                     SELECT 'pair_expired:' || pair_id, pair_id, NULL,
                            'pair_expired', ?
                     FROM cofounder_pair
                     WHERE last_activity_at <= ? AND report_status <> 'ready'
                       AND (SELECT COUNT(*) FROM pair_test
                            WHERE pair_id = cofounder_pair.pair_id
                              AND submitted_at IS NOT NULL) < 2`,
                )
                .bind(expiredAt, expiryCutoff),
            database.prepare(
                `DELETE FROM cofounder_pair
                 WHERE last_activity_at <= ? AND report_status <> 'ready'
                   AND (SELECT COUNT(*) FROM pair_test
                        WHERE pair_id = cofounder_pair.pair_id
                          AND submitted_at IS NOT NULL) < 2`,
            )
                .bind(expiryCutoff),
        ]);
        return result.meta.changes;
    },
});

const sendPairEmail = async (
    environment: AuthBindings,
    pending: PendingPairEmail,
) => {
    const content = renderPairEmail(
        pending.type,
        pending.expiresAt || undefined,
    );
    await sendEmail(
        environment,
        pending.email,
        content,
        `${pending.eventId}:${pending.userId}`,
    );
};

export const runPairLifecycle = async (
    repository: PairLifecycleRepository,
    send: (pending: PendingPairEmail) => Promise<void>,
    now: Date,
) => {
    const timestamp = now.toISOString();
    const cutoffs = pairLifecycleCutoffs(now);
    await repository.scheduleEmails({ now: timestamp, ...cutoffs });
    for (const pending of await repository.getPendingEmails(
        50,
        cutoffs.reminderCutoff,
        cutoffs.expiryCutoff,
    )) {
        try {
            await send(pending);
            await repository.markEmailDelivered(
                pending.eventId,
                pending.userId,
                timestamp,
            );
        } catch {
            console.error('Pair transactional email remains pending', {
                eventType: pending.type,
            });
        }
    }
    await repository.markCompletedEvents(timestamp);
    return repository.deleteExpired(cutoffs.expiryCutoff, timestamp);
};

export const runDefaultPairLifecycle = (environment: AuthBindings, now: Date) =>
    runPairLifecycle(
        createPairLifecycleRepository(environment.DB),
        (pending) => sendPairEmail(environment, pending),
        now,
    );
