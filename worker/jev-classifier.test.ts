import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
    createJevClassifier,
    DEFAULT_JEV_CONFIDENCE_THRESHOLD,
    JEV_DECISION_SCHEMA_VERSION,
    JEV_MODEL,
    OPENROUTER_JEV_MODEL,
    type ChoiceCandidateSet,
    type ClassificationRequest,
    TransientClassificationError,
} from './jev-classifier';
import { buildClassificationRequest } from './report-processor';
import { derivePairRules, type RulesParticipant } from './rules';

const featureVector: ClassificationRequest['featureVector'] = {
    schema_version: 'pair-feature-vector-v2',
    participant_role_codes: {
        participant_a: ['product'],
        participant_b: ['backend'],
    },
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

const set = (first: string, second: string): ChoiceCandidateSet => ({
    criteria: { [first]: `${first} criterion`, [second]: `${second} criterion` },
    fallback: first,
});

const request = (
    overrides: Partial<ClassificationRequest> = {},
): ClassificationRequest => ({
    featureVector,
    choices: {
        publicArchetype: set(
            'archetype.complementary-builders',
            'archetype.vision-reality',
        ),
        strongestAlignment: set('ambition', 'product'),
        valuableComplement: set('operating', 'external'),
        topRisk: set('dimension.risk', 'dimension.governance'),
        mirrorMisread: set(
            'mirror.accurate-model',
            'mirror.asymmetric-model',
        ),
        privateRiskPattern: set(
            'risk.parallel-solo-founders',
            'risk.quiet-reactive',
        ),
        conversationPrompts: [
            set('prompt.five-year-definition.1', 'prompt.hiring-window.1'),
            set('prompt.cash-at-six-months.1', 'prompt.product-evidence.1'),
            set('prompt.decision-deadlock.1', 'prompt.authority-model.1'),
            set('prompt.conflict-latency.1', 'prompt.work-boundary.1'),
            set('prompt.external-role.1', 'prompt.customer-crisis.1'),
        ],
    },
    ...overrides,
});

const setsFor = (input: ClassificationRequest) => ({
    public_archetype: input.choices.publicArchetype,
    strongest_alignment: input.choices.strongestAlignment,
    valuable_complement: input.choices.valuableComplement,
    top_risk: input.choices.topRisk,
    mirror_misread: input.choices.mirrorMisread,
    private_risk_pattern: input.choices.privateRiskPattern,
    conversation_prompt_1: input.choices.conversationPrompts[0],
    conversation_prompt_2: input.choices.conversationPrompts[1],
    conversation_prompt_3: input.choices.conversationPrompts[2],
    conversation_prompt_4: input.choices.conversationPrompts[3],
    conversation_prompt_5: input.choices.conversationPrompts[4],
});

const responseFor = (
    input: ClassificationRequest,
    selections: Record<string, string> = {},
    confidenceByQuestion: Record<string, number> = {},
) =>
    new Response(
        JSON.stringify({
            model: 'jev-1.13.0',
            answers: Object.fromEntries(
                Object.entries(setsFor(input)).map(([id, candidates]) => {
                    const options = Object.keys(candidates.criteria);
                    const choice = selections[id] ?? options[1] ?? options[0];
                    const confidence = confidenceByQuestion[id] ?? 0.9;
                    return [
                        id,
                        {
                            type: 'choice',
                            choice,
                            probabilities: Object.fromEntries(
                                options.map((option) => [
                                    option,
                                    option === choice
                                        ? confidence
                                        : (1 - confidence) /
                                          Math.max(1, options.length - 1),
                                ]),
                            ),
                            confidence,
                        },
                    ];
                }),
            ),
        }),
    );

describe('bounded Jev classifier', () => {
    it('asks all bounded questions and sends only the de-identified feature vector', async () => {
        let sent: any = null;
        let endpoint = '';
        const input = request();
        const classifier = createJevClassifier({
            jevApiKey: 'official-key',
            openRouterApiKey: 'fallback-key',
            confidenceThreshold: 0.8,
            fetcher: (async (url, init) => {
                endpoint = String(url);
                sent = JSON.parse(String(init?.body));
                return responseFor(input, {
                    public_archetype: 'archetype.vision-reality',
                });
            }) as typeof fetch,
        });

        const result = await classifier.classify(input);

        expect(result).toMatchObject({
            source: 'jev',
            provider: 'typesafe',
            requestedModel: JEV_MODEL,
            responseModel: 'jev-1.13.0',
            decisionSchemaVersion: JEV_DECISION_SCHEMA_VERSION,
            publicArchetypeId: 'archetype.vision-reality',
        });
        expect(result.promptIds).toHaveLength(5);
        expect(new Set(result.promptIds).size).toBe(5);
        expect(result.selectedContentIds).toContain(result.mirrorMisreadId);
        expect(result.selectedContentIds).toHaveLength(8);
        expect(endpoint).toBe('https://api.typesafe.ai/v1/systemone');
        expect(sent.model).toBe(JEV_MODEL);
        expect(sent.state).toEqual({
            classification_schema_version: JEV_DECISION_SCHEMA_VERSION,
            pair_features: featureVector,
        });
        expect(Object.keys(sent.questions)).toHaveLength(11);
        expect(JSON.stringify(sent.state)).not.toMatch(
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
                return calls.length === 1
                    ? new Response('', { status: 529 })
                    : responseFor(input);
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
        expect(result.provider).toBe('openrouter');
    });

    it('falls back only the individual low-confidence decision', async () => {
        const input = request();
        const classifier = createJevClassifier({
            jevApiKey: 'test-key',
            fetcher: (async () =>
                responseFor(
                    input,
                    { public_archetype: 'archetype.vision-reality' },
                    {
                        mirror_misread:
                            DEFAULT_JEV_CONFIDENCE_THRESHOLD - 0.01,
                    },
                )) as typeof fetch,
        });

        const result = await classifier.classify(input);

        expect(result).toMatchObject({
            source: 'mixed',
            provider: 'typesafe',
            publicArchetypeId: 'archetype.vision-reality',
            mirrorMisreadId: 'mirror.accurate-model',
            fallbackReason: 'below_confidence_threshold:mirror_misread',
        });
    });

    it('rejects malformed typed output and provider failures', async () => {
        const input = request();
        const malformed = createJevClassifier({
            jevApiKey: 'test-key',
            fetcher: (async () =>
                Response.json({ model: 'jev-1.13.0', answers: {} })) as typeof fetch,
        });
        const failed = createJevClassifier({
            jevApiKey: 'test-key',
            fetcher: (async () => new Response('', { status: 401 })) as typeof fetch,
        });

        const results = await Promise.all([
            malformed.classify(input),
            failed.classify(input),
        ]);

        expect(results.map(({ fallbackReason }) => fallbackReason)).toEqual([
            'malformed_typed_output',
            'provider_failure',
        ]);
        expect(results.every(({ source }) => source === 'conservative')).toBe(
            true,
        );
    });

    it('rejects choices outside each approved candidate set', async () => {
        const input = request();
        const classifier = createJevClassifier({
            jevApiKey: 'test-key',
            fetcher: (async () =>
                responseFor(input, {
                    private_risk_pattern: 'risk.not-approved',
                })) as typeof fetch,
        });

        const result = await classifier.classify(input);

        expect(result.source).toBe('conservative');
        expect(result.fallbackReason).toBe('malformed_typed_output');
    });

    it('marks rate limits, outages, and timeouts as retryable', async () => {
        for (const status of [429, 503, 529]) {
            const classifier = createJevClassifier({
                jevApiKey: 'test-key',
                fetcher: (async () => new Response('', { status })) as typeof fetch,
            });
            await expect(classifier.classify(request())).rejects.toBeInstanceOf(
                TransientClassificationError,
            );
        }

        const timeout = createJevClassifier({
            jevApiKey: 'test-key',
            timeoutMs: 1,
            fetcher: ((_url, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () =>
                        reject(new DOMException('Timed out', 'AbortError')),
                    );
                })) as typeof fetch,
        });
        await expect(timeout.classify(request())).rejects.toThrow(
            'classifier_timeout',
        );
    });

    it('keeps public archetype choices approved for all 20 mocks', async () => {
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
            const input = buildClassificationRequest(rules);
            const promptCandidateIds = input.choices.conversationPrompts.flatMap(
                ({ criteria }) => Object.keys(criteria),
            );
            expect(new Set(promptCandidateIds).size).toBe(promptCandidateIds.length);
            const approved = [
                row.approved_labels.preferred_public_archetype,
                ...row.approved_labels.acceptable_public_archetypes,
            ].map((id: string) => `archetype.${id}`);
            const choice = approved.find((id: string) =>
                Object.hasOwn(input.choices.publicArchetype.criteria, id),
            );
            expect(choice).toBeDefined();
            const classifier = createJevClassifier({
                jevApiKey: 'test-key',
                fetcher: (async () =>
                    responseFor(input, { public_archetype: choice })) as typeof fetch,
            });

            const result = await classifier.classify(input);

            expect(approved).toContain(result.publicArchetypeId);
            expect(result.promptIds).toHaveLength(5);
            expect(new Set(result.promptIds).size).toBe(5);
        }
    });
});
