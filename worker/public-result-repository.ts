import { contentLibraryV1 } from './content-library';
import type { PrivateReportFacts } from './report-repository';
import type { PublicResult } from './public-result-contract';

export type PublicResultLookup =
    | { status: 'published'; result: PublicResult }
    | { status: 'unavailable' }
    | null;

export type PublicResultPairState = {
    published: boolean;
    myNamePublic: boolean;
};

export interface PublicResultRepository {
    publish(input: {
        pairId: string;
        userId: string;
        slugHash: string;
        showMyName: boolean;
        publishedAt: string;
    }): Promise<'published' | 'not_found' | 'not_ready'>;
    setNamePermission(input: {
        pairId: string;
        userId: string;
        permitted: boolean;
        updatedAt: string;
    }): Promise<boolean>;
    unpublish(pairId: string, userId: string, unpublishedAt: string): Promise<boolean>;
    getPairState(pairId: string, userId: string): Promise<PublicResultPairState | null>;
    findBySlugHash(slugHash: string): Promise<PublicResultLookup>;
}

type PublicResultRow = {
    active: number;
    current_slug_hash: string | null;
    unpublished_at: string | null;
    published_at: string | null;
    creator_name: string | null;
    partner_name: string | null;
    creator_permitted: number | null;
    partner_permitted: number | null;
    report_json: string | null;
};

const publicResultFromRow = (row: PublicResultRow): PublicResultLookup => {
    if (
        row.active !== 1 ||
        row.unpublished_at ||
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
                creator:
                    row.creator_permitted === 1 && row.creator_name
                        ? row.creator_name
                        : '发起人',
                partner:
                    row.partner_permitted === 1 && row.partner_name
                        ? row.partner_name
                        : 'Cofounder',
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
    async publish({ pairId, userId, slugHash, showMyName, publishedAt }) {
        const results = await database.batch([
            database
                .prepare(
                    `INSERT INTO public_name_permission
                        (pair_id, user_id, permitted, updated_at)
                     SELECT pair_id, ?, ?, ? FROM cofounder_pair
                     WHERE pair_id = ?
                       AND (? = creator_user_id OR ? = partner_user_id)
                       AND report_status = 'ready'
                     ON CONFLICT (pair_id, user_id) DO UPDATE SET
                        permitted = excluded.permitted,
                        updated_at = excluded.updated_at`,
                )
                .bind(
                    userId,
                    showMyName ? 1 : 0,
                    publishedAt,
                    pairId,
                    userId,
                    userId,
                ),
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
        if (results[1].meta.changes === 1) return 'published';
        const exists = await database
            .prepare(
                `SELECT report_status FROM cofounder_pair
                 WHERE pair_id = ? AND (? = creator_user_id OR ? = partner_user_id)`,
            )
            .bind(pairId, userId, userId)
            .first<{ report_status: string }>();
        return exists ? 'not_ready' : 'not_found';
    },

    async setNamePermission({ pairId, userId, permitted, updatedAt }) {
        const result = await database
            .prepare(
                `INSERT INTO public_name_permission
                    (pair_id, user_id, permitted, updated_at)
                 SELECT pair_id, ?, ?, ? FROM cofounder_pair
                 WHERE pair_id = ?
                   AND (? = creator_user_id OR ? = partner_user_id)
                 ON CONFLICT (pair_id, user_id) DO UPDATE SET
                    permitted = excluded.permitted,
                    updated_at = excluded.updated_at`,
            )
            .bind(
                userId,
                permitted ? 1 : 0,
                updatedAt,
                pairId,
                userId,
                userId,
            )
            .run();
        return result.meta.changes === 1;
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
                `SELECT result.pair_id AS result_pair_id, result.unpublished_at,
                        COALESCE(permission.permitted, 0) AS permitted
                 FROM cofounder_pair pair
                 LEFT JOIN public_result result ON result.pair_id = pair.pair_id
                 LEFT JOIN public_name_permission permission
                   ON permission.pair_id = pair.pair_id AND permission.user_id = ?
                 WHERE pair.pair_id = ?
                   AND (? = pair.creator_user_id OR ? = pair.partner_user_id)`,
            )
            .bind(userId, pairId, userId, userId)
            .first<{
                result_pair_id: string | null;
                unpublished_at: string | null;
                permitted: number;
            }>();
        return row
            ? {
                  published:
                      row.result_pair_id !== null && row.unpublished_at === null,
                  myNamePublic: row.permitted === 1,
              }
            : null;
    },

    async findBySlugHash(slugHash) {
        const row = await database
            .prepare(
                `SELECT slug.active, result.current_slug_hash, result.unpublished_at,
                        result.published_at, creator.name AS creator_name,
                        partner.name AS partner_name,
                        creator_permission.permitted AS creator_permitted,
                        partner_permission.permitted AS partner_permitted,
                        pair_result.report_json
                 FROM public_result_slug slug
                 JOIN public_result result ON result.pair_id = slug.pair_id
                 JOIN cofounder_pair pair ON pair.pair_id = result.pair_id
                 JOIN user creator ON creator.id = pair.creator_user_id
                 JOIN user partner ON partner.id = pair.partner_user_id
                 JOIN pair_result ON pair_result.pair_id = pair.pair_id
                 LEFT JOIN public_name_permission creator_permission
                   ON creator_permission.pair_id = pair.pair_id
                  AND creator_permission.user_id = pair.creator_user_id
                 LEFT JOIN public_name_permission partner_permission
                   ON partner_permission.pair_id = pair.pair_id
                  AND partner_permission.user_id = pair.partner_user_id
                 WHERE slug.slug_hash = ?`,
            )
            .bind(slugHash)
            .first<PublicResultRow>();
        if (!row) return null;
        if (row.current_slug_hash !== slugHash) return { status: 'unavailable' };
        return publicResultFromRow(row);
    },
});
