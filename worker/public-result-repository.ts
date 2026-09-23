import { contentLibraryV1 } from './content-library';
import type { PrivateReportFacts } from './report-repository';
import type { PublicResult } from './public-result-contract';

export type PublicResultLookup =
    | { status: 'published'; result: PublicResult }
    | { status: 'withdrawn' }
    | { status: 'unavailable' }
    | null;

export type PublicResultPairState = {
    published: boolean;
};

export interface PublicResultRepository {
    publish(input: {
        pairId: string;
        userId: string;
        slugHash: string;
        publishedAt: string;
    }): Promise<'published' | 'not_found' | 'not_ready'>;
    unpublish(pairId: string, userId: string, unpublishedAt: string): Promise<boolean>;
    getPairState(pairId: string, userId: string): Promise<PublicResultPairState | null>;
    findBySlugHash(slugHash: string): Promise<PublicResultLookup>;
    findPairIdBySlugHash?(slugHash: string): Promise<string | null>;
}

type PublicResultRow = {
    active: number;
    current_slug_hash: string | null;
    unpublished_at: string | null;
    published_at: string | null;
    creator_name: string | null;
    partner_name: string | null;
    report_json: string | null;
};

const publicResultFromRow = (row: PublicResultRow): PublicResultLookup => {
    if (row.unpublished_at) return { status: 'withdrawn' };
    if (
        row.active !== 1 ||
        !row.report_json ||
        !row.published_at
    ) {
        return { status: 'unavailable' };
    }
    const report = JSON.parse(row.report_json) as PrivateReportFacts;
    const archetype = contentLibraryV1.publicArchetypes.find(
        ({ id }) => id === report.portrait.archetypeId,
    );
    if (!archetype) return { status: 'unavailable' };
    const cta = contentLibraryV1.commonCopy.find(
        ({ id }) => id === 'receipt.cta',
    )!;

    return {
        status: 'published',
        result: {
            status: 'published',
            names: {
                creator: row.creator_name || '发起人',
                partner: row.partner_name || 'Cofounder',
            },
            archetype: {
                title: archetype.title,
                englishTitle: archetype.englishTitle,
                explanation: archetype.explanation,
            },
            teamQuote: archetype.teamQuotes[0],
            safeTraits: archetype.safeTraits.slice(0, 3),
            date: row.published_at.slice(0, 10),
            versions: report.versions,
            cta: cta.copy,
        },
    };
};

export const createPublicResultRepository = (
    database: D1Database,
): PublicResultRepository => ({
    async publish({ pairId, userId, slugHash, publishedAt }) {
        const results = await database.batch([
            database
                .prepare(
                    `INSERT INTO public_result
                        (pair_id, current_slug_hash, published_at, unpublished_at)
                     SELECT pair_id, ?, ?, NULL FROM cofounder_pair
                     WHERE pair_id = ?
                       AND (? = creator_user_id OR ? = partner_user_id)
                       AND report_status = 'ready'
                       AND EXISTS (SELECT 1 FROM pair_result WHERE pair_id = ?)
                     ON CONFLICT (pair_id) DO UPDATE SET
                        current_slug_hash = excluded.current_slug_hash,
                        published_at = excluded.published_at,
                        unpublished_at = NULL`,
                )
                .bind(
                    slugHash,
                    publishedAt,
                    pairId,
                    userId,
                    userId,
                    pairId,
                ),
            database
                .prepare(
                    `UPDATE public_result_slug SET active = 0
                     WHERE pair_id = ? AND slug_hash <> ?`,
                )
                .bind(pairId, slugHash),
            database
                .prepare(
                    `INSERT INTO public_result_slug
                        (slug_hash, pair_id, created_at, active)
                     SELECT current_slug_hash, pair_id, ?, 1 FROM public_result
                     WHERE pair_id = ? AND current_slug_hash = ?`,
                )
                .bind(publishedAt, pairId, slugHash),
        ]);
        if (results[0].meta.changes === 1) return 'published';
        const exists = await database
            .prepare(
                `SELECT report_status FROM cofounder_pair
                 WHERE pair_id = ? AND (? = creator_user_id OR ? = partner_user_id)`,
            )
            .bind(pairId, userId, userId)
            .first<{ report_status: string }>();
        return exists ? 'not_ready' : 'not_found';
    },

    async unpublish(pairId, userId, unpublishedAt) {
        const results = await database.batch([
            database
                .prepare(
                    `UPDATE public_result SET unpublished_at = ?
                     WHERE pair_id = ? AND unpublished_at IS NULL
                       AND EXISTS (
                           SELECT 1 FROM cofounder_pair
                           WHERE pair_id = ?
                             AND (? = creator_user_id OR ? = partner_user_id)
                       )`,
                )
                .bind(unpublishedAt, pairId, pairId, userId, userId),
            database
                .prepare(
                    `UPDATE public_result_slug SET active = 0
                     WHERE pair_id = ? AND EXISTS (
                         SELECT 1 FROM public_result
                         WHERE pair_id = ? AND unpublished_at = ?
                     )`,
                )
                .bind(pairId, pairId, unpublishedAt),
        ]);
        return results[0].meta.changes === 1;
    },

    async getPairState(pairId, userId) {
        const row = await database
            .prepare(
                `SELECT result.pair_id AS result_pair_id, result.unpublished_at
                 FROM cofounder_pair pair
                 LEFT JOIN public_result result ON result.pair_id = pair.pair_id
                 WHERE pair.pair_id = ?
                   AND (? = pair.creator_user_id OR ? = pair.partner_user_id)`,
            )
            .bind(pairId, userId, userId)
            .first<{
                result_pair_id: string | null;
                unpublished_at: string | null;
            }>();
        return row
            ? {
                  published:
                      row.result_pair_id !== null && row.unpublished_at === null,
              }
            : null;
    },

    async findBySlugHash(slugHash) {
        const row = await database
            .prepare(
                `SELECT slug.active, result.current_slug_hash, result.unpublished_at,
                        result.published_at, creator.name AS creator_name,
                        partner.name AS partner_name,
                        pair_result.report_json
                 FROM public_result_slug slug
                 JOIN public_result result ON result.pair_id = slug.pair_id
                 JOIN cofounder_pair pair ON pair.pair_id = result.pair_id
                 JOIN user creator ON creator.id = pair.creator_user_id
                 JOIN user partner ON partner.id = pair.partner_user_id
                 LEFT JOIN pair_result ON pair_result.pair_id = pair.pair_id
                 WHERE slug.slug_hash = ?`,
            )
            .bind(slugHash)
            .first<PublicResultRow>();
        if (!row) return null;
        if (row.current_slug_hash !== slugHash) return { status: 'unavailable' };
        return publicResultFromRow(row);
    },
    async findPairIdBySlugHash(slugHash) {
        const row = await database
            .prepare(
                `SELECT slug.pair_id
                 FROM public_result_slug slug
                 JOIN public_result result ON result.pair_id = slug.pair_id
                 WHERE slug.slug_hash = ? AND slug.active = 1
                   AND result.current_slug_hash = slug.slug_hash
                   AND result.unpublished_at IS NULL`,
            )
            .bind(slugHash)
            .first<{ pair_id: string }>();
        return row?.pair_id || null;
    },
});
