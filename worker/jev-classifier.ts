export const JEV_MODEL = 'jev-1.13.0';
export const OPENROUTER_JEV_MODEL = 'typesafe/jev-1.13';
export const DEFAULT_JEV_CONFIDENCE_THRESHOLD = 0.8;
export const JEV_DECISION_SCHEMA_VERSION = 'cofounder-jev-decision-v1';

type JevProvider = 'typesafe' | 'openrouter';

export type PairFeatureVector = {
    schema_version: string;
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

export type ClassificationRequest = {
    featureVector: PairFeatureVector;
    publicArchetypeCandidates: string[];
    forbiddenPublicArchetypes: string[];
    conservativePublicArchetypeId: string;
};

export type ClassificationProvenance = {
    source: 'jev' | 'conservative';
    provider: JevProvider | null;
    requestedModel: typeof JEV_MODEL;
    responseModel: string | null;
    decisionSchemaVersion: typeof JEV_DECISION_SCHEMA_VERSION;
    probabilities: Record<string, number> | null;
    confidence: number | null;
    selectedContentIds: string[];
    fallbackReason: string | null;
};

export type ClassificationDecision = ClassificationProvenance & {
    publicArchetypeId: string;
};

export interface PairClassifier {
    classify(input: ClassificationRequest): Promise<ClassificationDecision>;
}

export class TransientClassificationError extends Error {}

const archetypeCriteria: Record<string, string> = {
    'vision-reality': 'Different but potentially useful vision and execution orientations.',
    'dual-big-outcome': 'Both participants consistently favor large, long-term outcomes.',
    'dual-product': 'Both participants strongly orient toward product and user evidence.',
    'cashflow-operators': 'Both participants emphasize revenue, delivery, and sustainable operation.',
    'research-lab': 'The team has a meaningful research orientation and technical exploration pattern.',
    'narrative-market-fit': 'The pair combines market narrative strength with operating evidence.',
    'complementary-monsters': 'Strong functional complement without multiple severe structural conflicts.',
    'complementary-builders': 'A neutral, share-safe identity for a broadly complementary pair.',
};

const conservativeDecision = (
    input: ClassificationRequest,
    reason: string,
): ClassificationDecision => ({
    source: 'conservative',
    provider: null,
    requestedModel: JEV_MODEL,
    responseModel: null,
    decisionSchemaVersion: JEV_DECISION_SCHEMA_VERSION,
    probabilities: null,
    confidence: null,
    selectedContentIds: [`archetype.${input.conservativePublicArchetypeId}`],
    fallbackReason: reason,
    publicArchetypeId: input.conservativePublicArchetypeId,
});

type JevChoiceAnswer = {
    type: 'choice';
    choice: string;
    probabilities: Record<string, number>;
    confidence: number;
};

const parseChoice = (
    value: unknown,
    input: ClassificationRequest,
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
        !input.publicArchetypeCandidates.includes(answer.choice) ||
        input.forbiddenPublicArchetypes.includes(answer.choice)
    ) {
        return null;
    }
    const expected = new Set(input.publicArchetypeCandidates);
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
                            questions: {
                                public_archetype: {
                                    type: 'choice',
                                    instructions:
                                        'Select the most representative share-safe Pair identity from the supplied approved candidates. Do not infer sensitive answers.',
                                    criteria: Object.fromEntries(
                                        input.publicArchetypeCandidates.map(
                                            (id) => [id, archetypeCriteria[id]],
                                        ),
                                    ),
                                },
                            },
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
                answers?: { public_archetype?: unknown };
            } | null;
            const answer = parseChoice(body?.answers?.public_archetype, input);
            if (!answer || typeof body?.model !== 'string') {
                permanentFailure = 'malformed_typed_output';
                continue;
            }
            if (answer.confidence < confidenceThreshold) {
                return {
                    ...conservativeDecision(input, 'below_confidence_threshold'),
                    provider: provider.id,
                    responseModel: body.model,
                    probabilities: answer.probabilities,
                    confidence: answer.confidence,
                };
            }
            return {
                source: 'jev',
                provider: provider.id,
                requestedModel: JEV_MODEL,
                responseModel: body.model,
                decisionSchemaVersion: JEV_DECISION_SCHEMA_VERSION,
                probabilities: answer.probabilities,
                confidence: answer.confidence,
                selectedContentIds: [`archetype.${answer.choice}`],
                fallbackReason: null,
                publicArchetypeId: answer.choice,
            };
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
