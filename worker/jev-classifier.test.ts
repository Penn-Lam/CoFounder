import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
    createJevClassifier,
    DEFAULT_JEV_CONFIDENCE_THRESHOLD,
    JEV_DECISION_SCHEMA_VERSION,
    JEV_MODEL,
    OPENROUTER_JEV_MODEL,
    type ClassificationRequest,
    TransientClassificationError,
} from './jev-classifier';
import { derivePairRules, type RulesParticipant } from './rules';

const featureVector: ClassificationRequest['featureVector'] = {
    schema_version: 'pair-feature-vector-v1',
    participant_dimension_bands: {
        participant_a: { ambition: 3 },
        participant_b: { ambition: 1 },
    },
    dimension_match_scores: { ambition: 60 },
    dimension_gaps: { ambition: 40 },
    authority_state: 'same_decision_maker',
    conflict_latency_gap_days: 0,
    mirror_counts: {
        participant_a_predicts_b: { exact: 3, near: 2, opposite: 1 },
        participant_b_predicts_a: { exact: 4, near: 1, opposite: 1 },
    },
    ordinary_conflict_flag_codes: [],
    narrative_tag_codes: [],
};

const request = (
    overrides: Partial<ClassificationRequest> = {},
): ClassificationRequest => ({
    featureVector,
    publicArchetypeCandidates: [
        'vision-reality',
        'complementary-builders',
        'cashflow-operators',
    ],
    forbiddenPublicArchetypes: [],
    conservativePublicArchetypeId: 'complementary-builders',
    ...overrides,
});

const responseFor = (
    choice: string,
    candidates: string[],
    confidence = 0.9,
) =>
    new Response(
        JSON.stringify({
            model: 'typesafe/jev-1.13-20260917',
            answers: {
                public_archetype: {
                    type: 'choice',
                    choice,
                    probabilities: Object.fromEntries(
                        candidates.map((id) => [
                            id,
                            id === choice ? confidence : (1 - confidence) / 2,
                        ]),
                    ),
                    confidence,
                },
            },
        }),
    );

describe('bounded Jev classifier', () => {
    it('pins the model and sends only the de-identified feature vector', async () => {
        let sent: Record<string, unknown> | null = null;
        let endpoint = '';
        const input = request();
        const classifier = createJevClassifier({
            jevApiKey: 'official-key',
            openRouterApiKey: 'fallback-key',
            confidenceThreshold: 0.8,
            fetcher: (async (url, init) => {
                endpoint = String(url);
                sent = JSON.parse(String(init?.body));
                return responseFor(
                    'vision-reality',
                    input.publicArchetypeCandidates,
                );
            }) as typeof fetch,
        });

        const result = await classifier.classify(input);

        expect(result).toMatchObject({
            source: 'jev',
            provider: 'typesafe',
            requestedModel: JEV_MODEL,
            responseModel: 'typesafe/jev-1.13-20260917',
            decisionSchemaVersion: JEV_DECISION_SCHEMA_VERSION,
            confidence: 0.9,
            selectedContentIds: ['archetype.vision-reality'],
        });
        expect(endpoint).toBe('https://api.typesafe.ai/v1/systemone');
        expect(sent?.model).toBe(JEV_MODEL);
        expect(sent?.state).toEqual({
            classification_schema_version: JEV_DECISION_SCHEMA_VERSION,
            pair_features: featureVector,
        });
        const serializedState = JSON.stringify(sent?.state);
        expect(serializedState).not.toMatch(
            /email|user_id|pair_id|display_name|raw_answer|red_line|sensitive/i,
        );
    });

    it('uses OpenRouter only when the official API fails', async () => {
        const calls: Array<{ endpoint: string; model: string }> = [];
        const input = request();
        const classifier = createJevClassifier({
            jevApiKey: 'official-key',
            openRouterApiKey: 'fallback-key',
            confidenceThreshold: 0.8,
            fetcher: (async (url, init) => {
                const body = JSON.parse(String(init?.body));
                calls.push({ endpoint: String(url), model: body.model });
                if (calls.length === 1) {
                    return new Response('', { status: 529 });
                }
                return responseFor(
                    'vision-reality',
                    input.publicArchetypeCandidates,
                );
            }) as typeof fetch,
        });

        const result = await classifier.classify(input);

        expect(calls).toEqual([
            {
                endpoint: 'https://api.typesafe.ai/v1/systemone',
                model: JEV_MODEL,
            },
            {
                endpoint: 'https://openrouter.ai/api/v1/systemone',
                model: OPENROUTER_JEV_MODEL,
            },
        ]);
        expect(result).toMatchObject({
            source: 'jev',
            provider: 'openrouter',
            publicArchetypeId: 'vision-reality',
        });
    });

    it('uses a conservative default confidence threshold when none is configured', async () => {
        const input = request();
        const classifier = createJevClassifier({
            jevApiKey: 'test-key',
            fetcher: (async () =>
                responseFor(
                    'vision-reality',
                    input.publicArchetypeCandidates,
                    DEFAULT_JEV_CONFIDENCE_THRESHOLD - 0.01,
                )) as typeof fetch,
        });

        const result = await classifier.classify(input);

        expect(result).toMatchObject({
            source: 'conservative',
            provider: 'typesafe',
            fallbackReason: 'below_confidence_threshold',
        });
    });

    it('falls back on low confidence, malformed output, and provider failure', async () => {
        const input = request();
        const cases = [
            createJevClassifier({
                jevApiKey: 'test-key',
                confidenceThreshold: 0.8,
                fetcher: (async () =>
                    responseFor(
                        'vision-reality',
                        input.publicArchetypeCandidates,
                        0.4,
                    )) as typeof fetch,
            }),
            createJevClassifier({
                jevApiKey: 'test-key',
                confidenceThreshold: 0.8,
                fetcher: (async () =>
                    Response.json({ answers: { public_archetype: 'invalid' } })) as typeof fetch,
            }),
            createJevClassifier({
                jevApiKey: 'test-key',
                confidenceThreshold: 0.8,
                fetcher: (async () => new Response('', { status: 401 })) as typeof fetch,
            }),
        ];

        const results = await Promise.all(
            cases.map((classifier) => classifier.classify(input)),
        );
        expect(results.map(({ source }) => source)).toEqual([
            'conservative',
            'conservative',
            'conservative',
        ]);
        expect(results.map(({ fallbackReason }) => fallbackReason)).toEqual([
            'below_confidence_threshold',
            'malformed_typed_output',
            'provider_failure',
        ]);
        for (const result of results) {
            expect(result.publicArchetypeId).toBe('complementary-builders');
        }
    });

    it('rejects forbidden or out-of-candidate typed choices', async () => {
        const input = request({ forbiddenPublicArchetypes: ['vision-reality'] });
        const classifier = createJevClassifier({
            jevApiKey: 'test-key',
            confidenceThreshold: 0.8,
            fetcher: (async () =>
                responseFor(
                    'vision-reality',
                    input.publicArchetypeCandidates,
                )) as typeof fetch,
        });

        const result = await classifier.classify(input);
        expect(result.source).toBe('conservative');
        expect(result.fallbackReason).toBe('malformed_typed_output');
    });

    it('marks rate limits and provider outages as retryable', async () => {
        for (const status of [429, 503]) {
            const classifier = createJevClassifier({
                jevApiKey: 'test-key',
                confidenceThreshold: 0.8,
                fetcher: (async () => new Response('', { status })) as typeof fetch,
            });
            await expect(classifier.classify(request())).rejects.toBeInstanceOf(
                TransientClassificationError,
            );
        }
    });

    it('aborts a slow provider at the configured timeout', async () => {
        const classifier = createJevClassifier({
            jevApiKey: 'test-key',
            confidenceThreshold: 0.8,
            timeoutMs: 1,
            fetcher: ((_url, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () =>
                        reject(new DOMException('Timed out', 'AbortError')),
                    );
                })) as typeof fetch,
        });

        await expect(classifier.classify(request())).rejects.toThrow(
            'classifier_timeout',
        );
    });

    it('accepts an approved alternative and rejects forbidden labels for all 20 mocks', async () => {
        const rows = readFileSync(
            'docs/calibration/mock-pairs-v0.jsonl',
            'utf8',
        )
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
        expect(rows).toHaveLength(20);

        for (const row of rows) {
            const participant = (value: any): RulesParticipant => ({
                profile: {
                    relationshipStages: value.profile.relationship_stages,
                    knownDuration: value.profile.known_duration,
                    workedDuration: value.profile.worked_duration,
                    responsibilities: value.profile.responsibilities,
                    companyAuthority: value.profile.company_authority,
                },
                core: value.pair_answers,
                mirror: value.mirror_answers,
                redLine: value.red_line_answers,
            });
            const rules = derivePairRules(
                participant(row.participants.a),
                participant(row.participants.b),
            );
            const approved = [
                row.approved_labels.preferred_public_archetype,
                ...row.approved_labels.acceptable_public_archetypes,
            ];
            const choice = approved.find((id: string) =>
                rules.publicFeatures.publicArchetypeCandidates.includes(id),
            );
            expect(choice).toBeDefined();
            const input = request({
                featureVector: rules.pairFeatureVector,
                publicArchetypeCandidates:
                    rules.publicFeatures.publicArchetypeCandidates,
                forbiddenPublicArchetypes: [
                    ...new Set([
                        ...rules.publicFeatures.forbiddenPublicArchetypes,
                        ...row.approved_labels.forbidden_public_archetypes,
                    ]),
                ],
                conservativePublicArchetypeId:
                    rules.conservativeResult.publicArchetypeId,
            });
            const classifier = createJevClassifier({
                jevApiKey: 'test-key',
                confidenceThreshold: 0.8,
                fetcher: (async () =>
                    responseFor(
                        choice,
                        input.publicArchetypeCandidates,
                    )) as typeof fetch,
            });

            const result = await classifier.classify(input);
            expect(approved).toContain(result.publicArchetypeId);
            expect(input.forbiddenPublicArchetypes).not.toContain(
                result.publicArchetypeId,
            );

            for (const forbidden of row.approved_labels
                .forbidden_public_archetypes) {
                const forbiddenClassifier = createJevClassifier({
                    jevApiKey: 'test-key',
                    confidenceThreshold: 0.8,
                    fetcher: (async () =>
                        responseFor(
                            forbidden,
                            input.publicArchetypeCandidates,
                        )) as typeof fetch,
                });
                const rejected = await forbiddenClassifier.classify(input);
                expect(rejected.source).toBe('conservative');
                expect(rejected.publicArchetypeId).not.toBe(forbidden);
            }
        }
    });
});
