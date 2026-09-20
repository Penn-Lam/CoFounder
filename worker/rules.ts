import questionBankJson from '../docs/calibration/question-bank-v0.json';
import type { PairProfile } from './questionnaire';

export const RULES_VERSION = 'cofounder-rules-v1';

export const DIMENSIONS = [
    'ambition',
    'risk',
    'money',
    'product',
    'governance',
    'conflict',
    'operating',
    'external',
] as const;

export type Dimension = (typeof DIMENSIONS)[number];
export type Severity = 'moderate' | 'high' | 'critical';
export type Relationship =
    'aligned' | 'productive_tension' | 'structural_difference';
export type MirrorRelation = 'exact' | 'near' | 'opposite';

export type RulesParticipant = {
    profile: PairProfile;
    core: Record<string, string>;
    mirror: Record<string, string>;
    redLine: Record<string, string>;
};

export type ConflictFlag = {
    id: string;
    severity: Severity;
    dimension: Dimension;
};

export type SensitiveSignal = {
    topic: string;
    state: 'aligned' | 'conflict' | 'unresolved';
    severity: Severity | null;
    ruleVersion: string;
};

type QuestionOption = {
    id: string;
    value?: number;
    latency_days?: number;
    tags?: string[];
};

type Question = {
    id: string;
    dimension: Dimension;
    weight: number;
    sensitive: boolean;
    options: QuestionOption[];
};

type RelationshipMatrix = {
    question_id: string;
    near_pairs: string[][];
    opposite_pairs: string[][];
};

type SensitiveMatrix = {
    question_id: string;
    topic: string;
    aligned_pairs: string[][];
    conflict_pairs: Array<{ options: string[]; severity: Severity }>;
};

type RedLineMatrix = {
    question_id: string;
    unresolved_options: string[];
    aligned_pairs: string[][];
    conflict_pairs: string[][];
    conflict_severity: Severity;
};

const questionBank = questionBankJson as unknown as {
    question_set_version: string;
    questions: Question[];
    mirror_question_ids: string[];
    mirror_relationships: RelationshipMatrix[];
    sensitive_core_relationships: SensitiveMatrix[];
    red_line_questions: Array<{
        id: string;
        topic: string;
        options: Array<{ id: string }>;
    }>;
    red_line_relationships: RedLineMatrix[];
};
const normalizedPair = (left: string, right: string) =>
    [left, right].sort().join(':');

const validatePairMatrix = (
    questionId: string,
    optionIds: string[],
    groups: Array<{ pairs: string[][]; label: string }>,
) => {
    const counts = new Map<string, number>();
    for (const { pairs, label } of groups) {
        for (const pair of pairs) {
            if (
                pair.length !== 2 ||
                pair.some((optionId) => !optionIds.includes(optionId))
            ) {
                throw new Error(
                    `Invalid ${label} pair ${questionId}:${pair.join(':')}`,
                );
            }
            const key = normalizedPair(pair[0], pair[1]);
            counts.set(key, (counts.get(key) || 0) + 1);
        }
    }
    for (let left = 0; left < optionIds.length; left += 1) {
        for (let right = left; right < optionIds.length; right += 1) {
            const key = normalizedPair(optionIds[left], optionIds[right]);
            if (counts.get(key) !== 1) {
                throw new Error(
                    `Pair matrix must classify ${questionId}:${key} exactly once`,
                );
            }
        }
    }
};

const validateQuestionBank = () => {
    if (!questionBank.question_set_version)
        throw new Error('Missing question set version');
    const questionIds = new Set<string>();
    for (const question of questionBank.questions) {
        if (questionIds.has(question.id))
            throw new Error(`Duplicate question ${question.id}`);
        questionIds.add(question.id);
        if (question.weight < 0)
            throw new Error(`Invalid weight ${question.id}`);
        const optionIds = question.options.map(({ id }) => id);
        if (new Set(optionIds).size !== optionIds.length) {
            throw new Error(`Duplicate option ${question.id}`);
        }
        if (
            question.weight > 0 &&
            question.options.some(({ value }) => typeof value !== 'number')
        ) {
            throw new Error(
                `Scored question has an unscored option ${question.id}`,
            );
        }
    }
    for (const matrix of questionBank.mirror_relationships) {
        const question = questionBank.questions.find(
            ({ id }) => id === matrix.question_id,
        );
        if (
            !question ||
            !questionBank.mirror_question_ids.includes(matrix.question_id)
        ) {
            throw new Error(`Invalid Mirror matrix ${matrix.question_id}`);
        }
        validatePairMatrix(
            matrix.question_id,
            question.options.map(({ id }) => id),
            [
                {
                    pairs: question.options.map(({ id }) => [id, id]),
                    label: 'exact',
                },
                { pairs: matrix.near_pairs, label: 'near' },
                { pairs: matrix.opposite_pairs, label: 'opposite' },
            ],
        );
    }
    for (const matrix of questionBank.sensitive_core_relationships) {
        const question = questionBank.questions.find(
            ({ id }) => id === matrix.question_id,
        );
        if (!question?.sensitive)
            throw new Error(`Invalid Sensitive matrix ${matrix.question_id}`);
        validatePairMatrix(
            matrix.question_id,
            question.options.map(({ id }) => id),
            [
                { pairs: matrix.aligned_pairs, label: 'aligned' },
                {
                    pairs: matrix.conflict_pairs.map(({ options }) => options),
                    label: 'conflict',
                },
            ],
        );
    }
    for (const matrix of questionBank.red_line_relationships) {
        const question = questionBank.red_line_questions.find(
            ({ id }) => id === matrix.question_id,
        );
        if (!question)
            throw new Error(`Invalid Red Line matrix ${matrix.question_id}`);
        const optionIds = question.options.map(({ id }) => id);
        const unresolvedPairs: string[][] = [];
        for (let left = 0; left < optionIds.length; left += 1) {
            for (let right = left; right < optionIds.length; right += 1) {
                if (
                    matrix.unresolved_options.includes(optionIds[left]) ||
                    matrix.unresolved_options.includes(optionIds[right])
                ) {
                    unresolvedPairs.push([optionIds[left], optionIds[right]]);
                }
            }
        }
        validatePairMatrix(matrix.question_id, optionIds, [
            { pairs: matrix.aligned_pairs, label: 'aligned' },
            { pairs: matrix.conflict_pairs, label: 'conflict' },
            { pairs: unresolvedPairs, label: 'unresolved' },
        ]);
    }
};

validateQuestionBank();

const questionById = new Map(
    questionBank.questions.map((question) => [question.id, question]),
);
const redLineTopicById = new Map(
    questionBank.red_line_questions.map(({ id, topic }) => [id, topic]),
);
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const rounded = (value: number) => Math.round(clamp(value));

const optionFor = (questionId: string, optionId: string) => {
    const question = questionById.get(questionId);
    const option = question?.options.find(({ id }) => id === optionId);
    if (!question || !option)
        throw new Error(`Invalid answer ${questionId}:${optionId}`);
    return { question, option };
};

export const participantDimensionValues = (
    answers: Record<string, string>,
    includedQuestionIds?: ReadonlySet<string>,
) => {
    const totals = Object.fromEntries(
        DIMENSIONS.map((dimension) => [dimension, { weighted: 0, weight: 0 }]),
    ) as Record<Dimension, { weighted: number; weight: number }>;

    for (const question of questionBank.questions) {
        if (includedQuestionIds && !includedQuestionIds.has(question.id))
            continue;
        if (question.weight <= 0) continue;
        const answer = answers[question.id];
        if (!answer) throw new Error(`Missing answer ${question.id}`);
        const { option } = optionFor(question.id, answer);
        if (typeof option.value !== 'number') {
            throw new Error(`Missing value ${question.id}:${answer}`);
        }
        totals[question.dimension].weighted += option.value * question.weight;
        totals[question.dimension].weight += question.weight;
    }

    return Object.fromEntries(
        DIMENSIONS.map((dimension) => {
            const total = totals[dimension];
            return [
                dimension,
                total.weight > 0
                    ? Math.round(total.weighted / total.weight)
                    : null,
            ];
        }),
    ) as Record<Dimension, number | null>;
};

const safeAmbitionValue = (answers: Record<string, string>) => {
    const values = ['Q2', 'Q3'].map(
        (id) => optionFor(id, answers[id]).option.value!,
    );
    return Math.round(
        values.reduce((sum, value) => sum + value, 0) / values.length,
    );
};

const complementMatch = (difference: number) => {
    if (difference <= 10) return 55;
    if (difference <= 25) return 75;
    if (difference <= 55) return 100;
    if (difference <= 70) return 80;
    return 55;
};

const thresholdMatch = (difference: number) =>
    difference <= 15 ? 100 : rounded(((85 - difference) / 70) * 100);

type AuthorityResult = {
    agreement: number;
    state:
        | 'same_decision_maker'
        | 'shared'
        | 'shared_and_sole'
        | 'undefined'
        | 'dual_self_claim'
        | 'different_sole';
};

const resolveAuthority = (
    answer: PairProfile['companyAuthority'],
    participant: 'a' | 'b',
) => {
    if (answer === 'self') return participant;
    if (answer === 'partner') return participant === 'a' ? 'b' : 'a';
    return answer;
};

export const authorityAgreement = (
    answerA: PairProfile['companyAuthority'],
    answerB: PairProfile['companyAuthority'],
): AuthorityResult => {
    const resolvedA = resolveAuthority(answerA, 'a');
    const resolvedB = resolveAuthority(answerB, 'b');
    if (resolvedA === 'undefined' || resolvedB === 'undefined') {
        return { agreement: 50, state: 'undefined' };
    }
    if (resolvedA === 'shared' && resolvedB === 'shared') {
        return { agreement: 100, state: 'shared' };
    }
    if (resolvedA === 'shared' || resolvedB === 'shared') {
        return { agreement: 60, state: 'shared_and_sole' };
    }
    if (resolvedA === resolvedB) {
        return { agreement: 100, state: 'same_decision_maker' };
    }
    if (answerA === 'self' && answerB === 'self') {
        return { agreement: 0, state: 'dual_self_claim' };
    }
    return { agreement: 0, state: 'different_sole' };
};

export const dimensionMatches = (
    valuesA: Record<Dimension, number>,
    valuesB: Record<Dimension, number>,
    authorityA: PairProfile['companyAuthority'],
    authorityB: PairProfile['companyAuthority'],
    conflictLatencyGapDays = 0,
) => {
    const differences = Object.fromEntries(
        DIMENSIONS.map((dimension) => [
            dimension,
            Math.abs(valuesA[dimension] - valuesB[dimension]),
        ]),
    ) as Record<Dimension, number>;
    const authority = authorityAgreement(authorityA, authorityB);
    const governancePreference = 100 - differences.governance;
    let governance = rounded(
        governancePreference * 0.4 + authority.agreement * 0.6,
    );
    if (authority.state === 'undefined') governance = Math.min(65, governance);
    if (authority.state === 'dual_self_claim')
        governance = Math.min(25, governance);
    const conflict = thresholdMatch(differences.conflict);
    const productDifference = differences.product;
    const productHealthy =
        governance >= 70 && conflict >= 70 && conflictLatencyGapDays < 14;
    const productRelation: Relationship =
        productDifference <= 25
            ? 'aligned'
            : productDifference <= 55 && productHealthy
              ? 'productive_tension'
              : 'structural_difference';
    const product =
        productRelation === 'aligned'
            ? 100 - productDifference
            : productRelation === 'productive_tension'
              ? 90
              : productDifference <= 55
                ? 45
                : Math.max(0, 100 - productDifference);
    let external = complementMatch(differences.external);
    if (valuesA.external < 30 && valuesB.external < 30)
        external = Math.min(65, external);

    return {
        ambition: {
            match: 100 - differences.ambition,
            relation: 'aligned' as Relationship,
        },
        risk: {
            match: thresholdMatch(differences.risk),
            relation: 'aligned' as Relationship,
        },
        money: {
            match: 100 - differences.money,
            relation: 'aligned' as Relationship,
        },
        product: { match: product, relation: productRelation },
        governance: { match: governance, relation: 'aligned' as Relationship },
        conflict: { match: conflict, relation: 'aligned' as Relationship },
        operating: {
            match: complementMatch(differences.operating),
            relation: 'aligned' as Relationship,
        },
        external: { match: external, relation: 'aligned' as Relationship },
        differences,
        authority,
    };
};

export const mirrorRelation = (
    questionId: string,
    predictedOption: string,
    actualOption: string,
): MirrorRelation => {
    const matrix = questionBank.mirror_relationships.find(
        ({ question_id }) => question_id === questionId,
    );
    if (!matrix) throw new Error(`Missing Mirror matrix ${questionId}`);
    optionFor(questionId, predictedOption);
    optionFor(questionId, actualOption);
    if (predictedOption === actualOption) return 'exact';
    const key = normalizedPair(predictedOption, actualOption);
    if (
        matrix.near_pairs.some(
            ([left, right]) => normalizedPair(left, right) === key,
        )
    ) {
        return 'near';
    }
    if (
        matrix.opposite_pairs.some(
            ([left, right]) => normalizedPair(left, right) === key,
        )
    ) {
        return 'opposite';
    }
    throw new Error(`Unclassified Mirror pair ${questionId}:${key}`);
};

const mirrorOutcomes = (
    predictor: RulesParticipant,
    target: RulesParticipant,
) => {
    const outcomes = questionBank.mirror_question_ids.map((questionId) => ({
        questionId,
        relation: mirrorRelation(
            questionId,
            predictor.mirror[questionId],
            target.core[questionId],
        ),
    }));
    return {
        outcomes,
        exact: outcomes.filter(({ relation }) => relation === 'exact').length,
        near: outcomes.filter(({ relation }) => relation === 'near').length,
        opposite: outcomes.filter(({ relation }) => relation === 'opposite')
            .length,
    };
};

const classifySensitive = (
    matrix: SensitiveMatrix | RedLineMatrix,
    answerA: string,
    answerB: string,
): SensitiveSignal => {
    const pair = normalizedPair(answerA, answerB);
    if ('unresolved_options' in matrix) {
        if (
            matrix.unresolved_options.includes(answerA) ||
            matrix.unresolved_options.includes(answerB)
        ) {
            return {
                topic: redLineTopicById.get(matrix.question_id)!,
                state: 'unresolved',
                severity: null,
                ruleVersion: RULES_VERSION,
            };
        }
        if (
            matrix.aligned_pairs.some(
                ([left, right]) => normalizedPair(left, right) === pair,
            )
        ) {
            return {
                topic: redLineTopicById.get(matrix.question_id)!,
                state: 'aligned',
                severity: null,
                ruleVersion: RULES_VERSION,
            };
        }
        if (
            matrix.conflict_pairs.some(
                ([left, right]) => normalizedPair(left, right) === pair,
            )
        ) {
            return {
                topic: redLineTopicById.get(matrix.question_id)!,
                state: 'conflict',
                severity: matrix.conflict_severity,
                ruleVersion: RULES_VERSION,
            };
        }
    } else {
        if (
            matrix.aligned_pairs.some(
                ([left, right]) => normalizedPair(left, right) === pair,
            )
        ) {
            return {
                topic: matrix.topic,
                state: 'aligned',
                severity: null,
                ruleVersion: RULES_VERSION,
            };
        }
        const conflict = matrix.conflict_pairs.find(
            ({ options }) => normalizedPair(options[0], options[1]) === pair,
        );
        if (conflict) {
            return {
                topic: matrix.topic,
                state: 'conflict',
                severity: conflict.severity,
                ruleVersion: RULES_VERSION,
            };
        }
    }
    throw new Error(
        `Unclassified Sensitive pair ${matrix.question_id}:${pair}`,
    );
};

export const sensitiveSignalFor = (
    questionId: string,
    answerA: string,
    answerB: string,
) => {
    const matrix =
        questionBank.sensitive_core_relationships.find(
            ({ question_id }) => question_id === questionId,
        ) ||
        questionBank.red_line_relationships.find(
            ({ question_id }) => question_id === questionId,
        );
    if (!matrix) throw new Error(`Missing Sensitive matrix ${questionId}`);
    return classifySensitive(matrix, answerA, answerB);
};

const conflictLatency = (answers: Record<string, string>) =>
    optionFor('Q16', answers.Q16).option.latency_days!;

const collectTags = (answers: Record<string, string>) =>
    questionBank.questions.flatMap((question) => {
        if (question.sensitive) return [];
        const answer = answers[question.id];
        return optionFor(question.id, answer).option.tags || [];
    });

export const dimensionBand = (value: number) => {
    if (value <= 20) return 0;
    if (value <= 40) return 1;
    if (value <= 60) return 2;
    if (value <= 80) return 3;
    return 4;
};

export const ordinaryConflictFlags = (input: {
    authorityState: AuthorityResult['state'];
    safeAmbitionGap: number;
    riskGap: number;
    moneyGap: number;
    productGap: number;
    productRelation: Relationship;
    conflictLatencyGapDays: number;
    operatingGap: number;
}): ConflictFlag[] => {
    const flags: ConflictFlag[] = [];
    if (input.authorityState === 'dual_self_claim') {
        flags.push({
            id: 'dual-sole-authority',
            severity: 'critical',
            dimension: 'governance',
        });
    }
    if (input.safeAmbitionGap >= 60) {
        flags.push({
            id: 'safe-ambition-gap',
            severity: 'high',
            dimension: 'ambition',
        });
    }
    if (input.riskGap >= 60) {
        flags.push({ id: 'risk-gap', severity: 'high', dimension: 'risk' });
    }
    if (input.moneyGap >= 60) {
        flags.push({ id: 'money-gap', severity: 'high', dimension: 'money' });
    }
    if (
        input.productRelation === 'structural_difference' &&
        input.productGap > 55
    ) {
        flags.push({
            id: 'product-large-structural-difference',
            severity: 'high',
            dimension: 'product',
        });
    }
    if (input.conflictLatencyGapDays >= 14) {
        flags.push({
            id: 'conflict-latency-gap',
            severity: 'high',
            dimension: 'conflict',
        });
    }
    if (input.operatingGap >= 70) {
        flags.push({
            id: 'operating-gap',
            severity: 'moderate',
            dimension: 'operating',
        });
    }
    return flags;
};

const publicCandidates = (
    participantA: RulesParticipant,
    participantB: RulesParticipant,
    safeValuesA: Record<Dimension, number>,
    safeValuesB: Record<Dimension, number>,
    flags: ConflictFlag[],
) => {
    const candidates: string[] = [];
    const forbidden: string[] = [];
    const safeAmbitionGap = Math.abs(
        safeValuesA.ambition - safeValuesB.ambition,
    );
    if (safeValuesA.ambition >= 65 && safeValuesB.ambition >= 65) {
        candidates.push('dual-big-outcome');
    }
    if (
        (safeValuesA.product + safeValuesB.product) / 2 >= 50 &&
        Math.abs(safeValuesA.product - safeValuesB.product) <= 25
    ) {
        candidates.push('dual-product');
    }
    if ((safeValuesA.money + safeValuesB.money) / 2 <= 55) {
        candidates.push('cashflow-operators');
    }
    if (
        participantA.profile.responsibilities.includes('research') ||
        participantB.profile.responsibilities.includes('research')
    ) {
        candidates.push('research-lab');
    }
    const tags = [
        ...collectTags(participantA.core),
        ...collectTags(participantB.core),
    ];
    if (
        tags.some(
            (tag) => tag.includes('narrative') || tag === 'capital-orientation',
        )
    ) {
        candidates.push('narrative-market-fit');
    }
    if (safeAmbitionGap >= 30) candidates.push('vision-reality');
    else forbidden.push('vision-reality');
    const complementaryDistance = ['operating', 'external'].some(
        (dimension) => {
            const gap = Math.abs(
                safeValuesA[dimension as Dimension] -
                    safeValuesB[dimension as Dimension],
            );
            return gap >= 26 && gap <= 70;
        },
    );
    const severeFlags = flags.filter(
        ({ severity }) => severity !== 'moderate',
    ).length;
    if (complementaryDistance && severeFlags < 2)
        candidates.push('complementary-monsters');
    else if (severeFlags >= 2) forbidden.push('complementary-monsters');
    candidates.push('complementary-builders');

    const scoredAlternatives = [
        {
            id: 'dual-big-outcome',
            score: (safeValuesA.ambition + safeValuesB.ambition) / 2,
        },
        {
            id: 'dual-product',
            score:
                (safeValuesA.product + safeValuesB.product) / 2 -
                Math.abs(safeValuesA.product - safeValuesB.product),
        },
        {
            id: 'cashflow-operators',
            score: 100 - (safeValuesA.money + safeValuesB.money) / 2,
        },
        {
            id: 'narrative-market-fit',
            score:
                (safeValuesA.external + safeValuesB.external) / 2 +
                (tags.length > 0 ? 20 : 0),
        },
        {
            id: 'research-lab',
            score:
                Number(
                    participantA.profile.responsibilities.includes('research'),
                ) *
                    50 +
                Number(
                    participantB.profile.responsibilities.includes('research'),
                ) *
                    50,
        },
    ].sort((left, right) => right.score - left.score);
    for (const alternative of scoredAlternatives) {
        if (new Set(candidates).size >= 3) break;
        if (
            !forbidden.includes(alternative.id) &&
            !candidates.includes(alternative.id)
        ) {
            candidates.push(alternative.id);
        }
    }

    return {
        candidates: [...new Set(candidates)].slice(0, 5),
        forbidden: [...new Set(forbidden)],
    };
};

export const derivePairRules = (
    participantA: RulesParticipant,
    participantB: RulesParticipant,
) => {
    const rawValuesA = participantDimensionValues(participantA.core);
    const rawValuesB = participantDimensionValues(participantB.core);
    const valuesA = rawValuesA as Record<Dimension, number>;
    const valuesB = rawValuesB as Record<Dimension, number>;
    const safeValuesA = {
        ...valuesA,
        ambition: safeAmbitionValue(participantA.core),
    };
    const safeValuesB = {
        ...valuesB,
        ambition: safeAmbitionValue(participantB.core),
    };
    const latencyA = conflictLatency(participantA.core);
    const latencyB = conflictLatency(participantB.core);
    const conflictLatencyGapDays = Math.abs(latencyA - latencyB);
    const matches = dimensionMatches(
        valuesA,
        valuesB,
        participantA.profile.companyAuthority,
        participantB.profile.companyAuthority,
        conflictLatencyGapDays,
    );
    const safeAmbitionGap = Math.abs(
        safeValuesA.ambition - safeValuesB.ambition,
    );
    const flags = ordinaryConflictFlags({
        authorityState: matches.authority.state,
        safeAmbitionGap,
        riskGap: matches.differences.risk,
        moneyGap: matches.differences.money,
        productGap: matches.differences.product,
        productRelation: matches.product.relation,
        conflictLatencyGapDays,
        operatingGap: matches.differences.operating,
    });

    const sensitiveSignals = [
        ...questionBank.sensitive_core_relationships.map((matrix) =>
            classifySensitive(
                matrix,
                participantA.core[matrix.question_id],
                participantB.core[matrix.question_id],
            ),
        ),
        ...questionBank.red_line_relationships.map((matrix) =>
            classifySensitive(
                matrix,
                participantA.redLine[matrix.question_id],
                participantB.redLine[matrix.question_id],
            ),
        ),
    ];
    const candidateResult = publicCandidates(
        participantA,
        participantB,
        safeValuesA,
        safeValuesB,
        flags,
    );

    return {
        questionSetVersion: questionBank.question_set_version,
        rulesVersion: RULES_VERSION,
        participants: {
            a: {
                values: valuesA,
                bands: Object.fromEntries(
                    DIMENSIONS.map((dimension) => [
                        dimension,
                        dimensionBand(valuesA[dimension]),
                    ]),
                ) as Record<Dimension, number>,
                conflictLatencyDays: latencyA,
            },
            b: {
                values: valuesB,
                bands: Object.fromEntries(
                    DIMENSIONS.map((dimension) => [
                        dimension,
                        dimensionBand(valuesB[dimension]),
                    ]),
                ) as Record<Dimension, number>,
                conflictLatencyDays: latencyB,
            },
        },
        dimensions: Object.fromEntries(
            DIMENSIONS.map((dimension) => [dimension, matches[dimension]]),
        ) as Record<Dimension, { match: number; relation: Relationship }>,
        mirror: {
            aPredictsB: mirrorOutcomes(participantA, participantB),
            bPredictsA: mirrorOutcomes(participantB, participantA),
        },
        conflictFlags: flags,
        sensitiveSignals,
        unresolvedTopics: sensitiveSignals
            .filter(({ state }) => state === 'unresolved')
            .map(({ topic }) => topic),
        publicFeatures: {
            rulesVersion: RULES_VERSION,
            participantBands: {
                a: Object.fromEntries(
                    DIMENSIONS.map((dimension) => [
                        dimension,
                        dimensionBand(safeValuesA[dimension]),
                    ]),
                ),
                b: Object.fromEntries(
                    DIMENSIONS.map((dimension) => [
                        dimension,
                        dimensionBand(safeValuesB[dimension]),
                    ]),
                ),
            },
            dimensionGaps: Object.fromEntries(
                DIMENSIONS.map((dimension) => [
                    dimension,
                    Math.abs(safeValuesA[dimension] - safeValuesB[dimension]),
                ]),
            ),
            ordinaryConflictFlagIds: flags.map(({ id }) => id),
            tags: [
                ...new Set([
                    ...collectTags(participantA.core),
                    ...collectTags(participantB.core),
                ]),
            ],
            publicArchetypeCandidates: candidateResult.candidates,
            forbiddenPublicArchetypes: candidateResult.forbidden,
        },
        conservativeResult: {
            publicArchetypeId:
                candidateResult.candidates[0] || 'complementary-builders',
        },
    };
};
