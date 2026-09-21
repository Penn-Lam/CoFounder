export const JEV_MODEL = 'jev-1.13.0';
export const OPENROUTER_JEV_MODEL = 'typesafe/jev-1.13';
export const DEFAULT_JEV_CONFIDENCE_THRESHOLD = 0.3;
export const JEV_DECISION_SCHEMA_VERSION = 'cofounder-jev-decision-v2';

type JevProvider = 'typesafe' | 'openrouter';

export type PairFeatureVector = {
    schema_version: string;
    participant_role_codes: Record<string, string[]>;
    participant_dimension_bands: Record<string, Record<string, number>>;
    dimension_match_scores: Record<string, number>;
    dimension_gaps: Record<string, number>;
    authority_state: string;
    conflict_latency_gap_days: number;
    mirror_counts: Record<
        string,
        { exact: number; near: number; opposite: number }
    >;
    ordinary_conflict_flag_codes: string[];
    narrative_tag_codes: string[];
};

export type ChoiceCandidateSet = {
    criteria: Record<string, string>;
    fallback: string;
};

export type ClassificationRequest = {
    featureVector: PairFeatureVector;
    choices: {
        publicArchetype: ChoiceCandidateSet;
        strongestAlignment: ChoiceCandidateSet;
        valuableComplement: ChoiceCandidateSet;
        topRisk: ChoiceCandidateSet;
        mirrorMisread: ChoiceCandidateSet;
        privateRiskPattern: ChoiceCandidateSet;
        conversationPrompts: [
            ChoiceCandidateSet,
            ChoiceCandidateSet,
            ChoiceCandidateSet,
            ChoiceCandidateSet,
            ChoiceCandidateSet,
        ];
    };
};

export type ClassificationProvenance = {
    source: 'jev' | 'mixed' | 'conservative';
    provider: JevProvider | null;
    requestedModel: typeof JEV_MODEL;
    responseModel: string | null;
    decisionSchemaVersion: typeof JEV_DECISION_SCHEMA_VERSION;
    probabilities: Record<string, Record<string, number>> | null;
    confidence: Record<string, number> | null;
    selectedContentIds: string[];
    fallbackReason: string | null;
};

export type ClassificationDecision = ClassificationProvenance & {
    publicArchetypeId: string;
    alignmentDimension: string;
    complementDimension: string;
    topRiskId: string;
    mirrorMisreadId: string;
    privateRiskPatternId: string;
    promptIds: [string, string, string, string, string];
};

export interface PairClassifier {
    classify(input: ClassificationRequest): Promise<ClassificationDecision>;
}

export class TransientClassificationError extends Error {}

const questionInstructions = {
    public_archetype:
        'Select the most representative share-safe Pair identity. Do not infer sensitive answers.',
    strongest_alignment:
        'Select the alignment that is most meaningful to this Pair, not merely the numerically highest tie.',
    valuable_complement:
        'Select the difference most likely to create useful functional complement rather than friction.',
    top_risk:
        'Select the single ordinary, non-sensitive issue most important for the Pair to discuss first.',
    mirror_misread:
        'Classify the most useful summary of how accurately the participants model each other.',
    private_risk_pattern:
        'Select the private risk pattern that best explains the Pair feature vector without diagnosing either person.',
    conversation_prompt_1:
        'Select the most useful ambition or risk conversation for this Pair.',
    conversation_prompt_2:
        'Select the most useful money or product conversation for this Pair.',
    conversation_prompt_3:
        'Select the most useful governance conversation for this Pair.',
    conversation_prompt_4:
        'Select the most useful conflict or operating conversation for this Pair.',
    conversation_prompt_5:
        'Select the most useful external-role conversation for this Pair.',
};

type QuestionId = keyof typeof questionInstructions;

const questionSets = (input: ClassificationRequest) => ({
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

const conservativeDecision = (
    input: ClassificationRequest,
    reason: string,
): ClassificationDecision => {
    const questions = questionSets(input);
    return decisionFromSelections({
        input,
        selections: Object.fromEntries(
            Object.entries(questions).map(([id, set]) => [id, set.fallback]),
        ) as Record<QuestionId, string>,
        source: 'conservative',
        provider: null,
        responseModel: null,
        probabilities: null,
        confidence: null,
        fallbackReason: reason,
    });
};

type JevChoiceAnswer = {
    type: 'choice';
    choice: string;
    probabilities: Record<string, number>;
    confidence: number;
};

const parseChoice = (
    value: unknown,
    candidates: ChoiceCandidateSet,
): JevChoiceAnswer | null => {
    if (!value || typeof value !== 'object') return null;
    const answer = value as Partial<JevChoiceAnswer>;
    if (
        answer.type !== 'choice' ||
        typeof answer.choice !== 'string' ||
        !answer.probabilities ||
        typeof answer.probabilities !== 'object' ||
        typeof answer.confidence !== 'number' ||
        !Number.isFinite(answer.confidence) ||
        answer.confidence < 0 ||
        answer.confidence > 1 ||
        !Object.hasOwn(candidates.criteria, answer.choice)
    ) {
        return null;
    }
    const expected = new Set(Object.keys(candidates.criteria));
    const entries = Object.entries(answer.probabilities);
    if (
        entries.length !== expected.size ||
        entries.some(
            ([id, probability]) =>
                !expected.has(id) ||
                typeof probability !== 'number' ||
                !Number.isFinite(probability) ||
                probability < 0 ||
                probability > 1,
        )
    ) {
        return null;
    }
    return answer as JevChoiceAnswer;
};

const decisionFromSelections = (input: {
    input: ClassificationRequest;
    selections: Record<QuestionId, string>;
    source: ClassificationProvenance['source'];
    provider: JevProvider | null;
    responseModel: string | null;
    probabilities: ClassificationProvenance['probabilities'];
    confidence: ClassificationProvenance['confidence'];
    fallbackReason: string | null;
}): ClassificationDecision => {
    const promptIds = [
        input.selections.conversation_prompt_1,
        input.selections.conversation_prompt_2,
        input.selections.conversation_prompt_3,
        input.selections.conversation_prompt_4,
        input.selections.conversation_prompt_5,
    ] as ClassificationDecision['promptIds'];
    const selectedContentIds = [
        input.selections.public_archetype,
        input.selections.mirror_misread,
        input.selections.private_risk_pattern,
        ...promptIds,
    ];
    return {
        source: input.source,
        provider: input.provider,
        requestedModel: JEV_MODEL,
        responseModel: input.responseModel,
        decisionSchemaVersion: JEV_DECISION_SCHEMA_VERSION,
        probabilities: input.probabilities,
        confidence: input.confidence,
        selectedContentIds,
        fallbackReason: input.fallbackReason,
        publicArchetypeId: input.selections.public_archetype,
        alignmentDimension: input.selections.strongest_alignment,
        complementDimension: input.selections.valuable_complement,
        topRiskId: input.selections.top_risk,
        mirrorMisreadId: input.selections.mirror_misread,
        privateRiskPatternId: input.selections.private_risk_pattern,
        promptIds,
    };
};

export const createJevClassifier = (configuration: {
    jevApiKey?: string;
    openRouterApiKey?: string;
    confidenceThreshold?: number;
    fetcher?: typeof fetch;
    timeoutMs?: number;
}): PairClassifier => ({
    async classify(input) {
        const providers = [
            configuration.jevApiKey
                ? {
                      id: 'typesafe' as const,
                      apiKey: configuration.jevApiKey,
                      endpoint: 'https://api.typesafe.ai/v1/systemone',
                      model: JEV_MODEL,
                  }
                : null,
            configuration.openRouterApiKey
                ? {
                      id: 'openrouter' as const,
                      apiKey: configuration.openRouterApiKey,
                      endpoint: 'https://openrouter.ai/api/v1/systemone',
                      model: OPENROUTER_JEV_MODEL,
                  }
                : null,
        ].filter((provider) => provider !== null);
        if (providers.length === 0) {
            return conservativeDecision(input, 'provider_not_configured');
        }
        const confidenceThreshold =
            configuration.confidenceThreshold ??
            DEFAULT_JEV_CONFIDENCE_THRESHOLD;
        let transientFailure: string | null = null;
        let permanentFailure: string | null = null;
        for (const provider of providers) {
            const controller = new AbortController();
            const timeout = setTimeout(
                () => controller.abort(),
                configuration.timeoutMs ?? 3000,
            );
            let response: Response;
            try {
                response = await (configuration.fetcher ?? fetch)(
                    provider.endpoint,
                    {
                        method: 'POST',
                        headers: {
                            authorization: `Bearer ${provider.apiKey}`,
                            'content-type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: provider.model,
                            state: {
                                classification_schema_version:
                                    JEV_DECISION_SCHEMA_VERSION,
                                pair_features: input.featureVector,
                            },
                            questions: Object.fromEntries(
                                Object.entries(questionSets(input)).map(
                                    ([id, candidates]) => [
                                        id,
                                        {
                                            type: 'choice',
                                            instructions:
                                                questionInstructions[
                                                    id as QuestionId
                                                ],
                                            criteria: candidates.criteria,
                                        },
                                    ],
                                ),
                            ),
                        }),
                        signal: controller.signal,
                    },
                );
            } catch (error) {
                transientFailure =
                    error instanceof Error && error.name === 'AbortError'
                        ? 'classifier_timeout'
                        : 'classifier_unavailable';
                continue;
            } finally {
                clearTimeout(timeout);
            }

            if (response.status === 429 || response.status >= 500) {
                transientFailure =
                    response.status === 429
                        ? 'classifier_rate_limited'
                        : 'classifier_unavailable';
                continue;
            }
            if (!response.ok) {
                permanentFailure = 'provider_failure';
                continue;
            }

            const body = (await response.json().catch(() => null)) as {
                model?: unknown;
                answers?: Record<string, unknown>;
            } | null;
            const questions = questionSets(input);
            const answers = Object.fromEntries(
                Object.entries(questions).map(([id, candidates]) => [
                    id,
                    parseChoice(body?.answers?.[id], candidates),
                ]),
            ) as Record<QuestionId, JevChoiceAnswer | null>;
            if (
                typeof body?.model !== 'string' ||
                Object.values(answers).some((answer) => answer === null)
            ) {
                permanentFailure = 'malformed_typed_output';
                continue;
            }
            const lowConfidence: QuestionId[] = [];
            const selections = Object.fromEntries(
                Object.entries(answers).map(([id, answer]) => {
                    const questionId = id as QuestionId;
                    const typedAnswer = answer!;
                    if (typedAnswer.confidence < confidenceThreshold) {
                        lowConfidence.push(questionId);
                        return [questionId, questions[questionId].fallback];
                    }
                    return [questionId, typedAnswer.choice];
                }),
            ) as Record<QuestionId, string>;
            return decisionFromSelections({
                input,
                selections,
                source:
                    lowConfidence.length === 0
                        ? 'jev'
                        : lowConfidence.length === Object.keys(questions).length
                          ? 'conservative'
                          : 'mixed',
                provider: provider.id,
                responseModel: body.model,
                probabilities: Object.fromEntries(
                    Object.entries(answers).map(([id, answer]) => [
                        id,
                        answer!.probabilities,
                    ]),
                ),
                confidence: Object.fromEntries(
                    Object.entries(answers).map(([id, answer]) => [
                        id,
                        answer!.confidence,
                    ]),
                ),
                fallbackReason:
                    lowConfidence.length > 0
                        ? `below_confidence_threshold:${lowConfidence.join(',')}`
                        : null,
            });
        }
        if (transientFailure) {
            throw new TransientClassificationError(transientFailure);
        }
        return conservativeDecision(
            input,
            permanentFailure ?? 'provider_failure',
        );
    },
});
