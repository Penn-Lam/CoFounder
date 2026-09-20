export type ProductEventType =
    | 'test_started'
    | 'participant_completed'
    | 'invitation_created'
    | 'invitation_shared'
    | 'partner_opened'
    | 'partner_started'
    | 'pair_completed'
    | 'result_viewed'
    | 'public_generated'
    | 'pair_shared'
    | 'participant_withdrawn'
    | 'pair_expired';

export type ProductEvent = {
    eventId: string;
    pairId?: string;
    userId?: string;
    type: ProductEventType;
    createdAt: string;
};

export interface ProductAnalyticsRepository {
    record(event: ProductEvent): Promise<boolean>;
}

export const createProductAnalyticsRepository = (
    database: D1Database,
): ProductAnalyticsRepository => ({
    async record(event) {
        const result = await database
            .prepare(
                `INSERT OR IGNORE INTO product_event
                    (event_id, pair_id, user_id, event_type, created_at)
                 VALUES (?, ?, ?, ?, ?)`,
            )
            .bind(
                event.eventId,
                event.pairId || null,
                event.userId || null,
                event.type,
                event.createdAt,
            )
            .run();
        return result.meta.changes === 1;
    },
});
