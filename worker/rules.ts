import questionBankJson from '../docs/calibration/question-bank-v0.json';
import type { PairProfile } from './questionnaire';

export const RULES_VERSION = 'cofounder-rules-v3';
export const PAIR_FEATURE_VECTOR_VERSION = 'pair-feature-vector-v3';

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

export type ClassificationSignals = {
    dimensionsByLowestMatch: Dimension[];
    conflictFlagIdsByPriority: string[];
    mirrorQuestionIdsByMisread: string[];
    unresolvedTopicsByPriority: string[];
};

export type SensitiveSignal = {
    topic: string;
    state: 'aligned' | 'conflict' | 'unresolved';
    severity: Severity | null;
    ruleVersion: string;
};

export type RelationshipAxes = {
    direction: { alignment: number; mode: 'in_sync' | 'distinct_emphasis' };
    capability: { complementarity: number; mode: 'similar' | 'complementary' };
    power: { clarity: number; mode: 'single_core' | 'dual_core' | 'unresolved' };
    pace: {
        participantA: number;
        participantB: number;
        contrast: number;
        mode: 'aggressive' | 'steady' | 'mixed';
    };
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

const severityRank = (severity: Severity) =>
    severity === 'critical' ? 3 : severity === 'high' ? 2 : 1;

const roleSimilarity = (left: string[], right: string[]) => {
    const union = new Set([...left, ...right]);
    if (union.size === 0) return 100;
    const intersection = new Set(left.filter((role) => right.includes(role)));
    return rounded((intersection.size / union.size) * 100);
};

const hasAnyRole = (roles: string[], candidates: string[]) =>
    candidates.some((role) => roles.includes(role));

type PairTypeSignals = {
    axes: RelationshipAxes;
    directionAlignment: number;
    capabilityComplementarity: number;
    understanding: number;
    visionExecutionSplit: number;
    externalInternalSplit: number;
    methodContrast: number;
    autonomy: number;
    governanceMatch: number;
    conflictMatch: number;
};

export const rankPairTypes = (signals: PairTypeSignals) => {
    const dualCoreStrength =
        signals.axes.power.mode === 'dual_core'
            ? 100
            : signals.axes.power.mode === 'unresolved'
              ? 55
              : 25;
    const scores = {
        chopsticks: rounded(
            signals.directionAlignment * 0.35 +
                (100 - signals.capabilityComplementarity) * 0.2 +
                signals.understanding * 0.3 +
                signals.conflictMatch * 0.15,
        ),
        'split-pot': rounded(
            signals.directionAlignment * 0.35 +
                signals.axes.pace.contrast * 0.45 +
                (100 - signals.conflictMatch) * 0.2,
        ),
        'two-stage-rocket': rounded(
            signals.visionExecutionSplit * 0.5 +
                signals.directionAlignment * 0.3 +
                signals.capabilityComplementarity * 0.2,
        ),
        'sushi-roll': rounded(
            signals.externalInternalSplit * 0.55 +
                signals.capabilityComplementarity * 0.25 +
                signals.directionAlignment * 0.2,
        ),
        'dual-core': rounded(
            dualCoreStrength * 0.5 +
                signals.autonomy * 0.3 +
                signals.directionAlignment * 0.2,
        ),
        gears: rounded(
            signals.capabilityComplementarity * 0.6 +
                signals.governanceMatch * 0.2 +
                signals.directionAlignment * 0.2,
        ),
        'double-helix': rounded(
            signals.directionAlignment * 0.45 +
                signals.methodContrast * 0.45 +
                signals.governanceMatch * 0.1,
        ),
        sailboat: rounded(
            Math.max(
                signals.axes.pace.participantA,
                signals.axes.pace.participantB,
            ) *
                0.3 +
                signals.governanceMatch * 0.4 +
                signals.axes.pace.contrast * 0.3,
        ),
    };
    return Object.entries(scores)
        .sort((left, right) => right[1] - left[1])
        .map(([id, score]) => ({ id, score }));
};

const publicCandidates = (
    participantA: RulesParticipant,
    participantB: RulesParticipant,
    safeValuesA: Record<Dimension, number>,
    safeValuesB: Record<Dimension, number>,
    publicMatches: ReturnType<typeof dimensionMatches>,
    publicMirrorCounts: {
        a: { exact: number; near: number; opposite: number };
        b: { exact: number; near: number; opposite: number };
    },
    flags: ConflictFlag[],
) => {
    const rolesA = participantA.profile.responsibilities;
    const rolesB = participantB.profile.responsibilities;
    const tags = [
        ...collectTags(participantA.core),
        ...collectTags(participantB.core),
    ];
    const directionAlignment = rounded(
        (publicMatches.ambition.match +
            publicMatches.money.match +
            publicMatches.product.match) /
            3,
    );
    const roleSimilarityScore = roleSimilarity(rolesA, rolesB);
    const capabilityComplementarity = rounded(
        (100 - roleSimilarityScore) * 0.5 +
            ((publicMatches.operating.match + publicMatches.external.match) / 2) *
                0.5,
    );
    const paceA = rounded((safeValuesA.risk + safeValuesA.operating) / 2);
    const paceB = rounded((safeValuesB.risk + safeValuesB.operating) / 2);
    const paceContrast = Math.abs(paceA - paceB);
    const exactTotal = publicMirrorCounts.a.exact + publicMirrorCounts.b.exact;
    const understanding = Math.min(100, exactTotal * 10);
    const externalRoles = ['sales', 'bd', 'marketing-pr', 'fundraising'];
    const internalRoles = [
        'frontend',
        'backend',
        'ai-models',
        'research',
        'design',
        'customer-delivery',
        'finance',
        'company-management',
    ];
    const visionRoles = ['product', 'strategy', 'fundraising', 'marketing-pr'];
    const executionRoles = [
        'frontend',
        'backend',
        'ai-models',
        'customer-delivery',
        'finance',
        'company-management',
    ];
    const splitScore = (left: string[], right: string[]) =>
        Math.max(
            Number(hasAnyRole(rolesA, left) && hasAnyRole(rolesB, right)),
            Number(hasAnyRole(rolesB, left) && hasAnyRole(rolesA, right)),
        ) * 100;
    const powerMode: RelationshipAxes['power']['mode'] =
        publicMatches.authority.state === 'same_decision_maker'
            ? 'single_core'
            : publicMatches.authority.state === 'shared'
              ? 'dual_core'
              : 'unresolved';
    const axes: RelationshipAxes = {
        direction: {
            alignment: directionAlignment,
            mode: directionAlignment >= 75 ? 'in_sync' : 'distinct_emphasis',
        },
        capability: {
            complementarity: capabilityComplementarity,
            mode: capabilityComplementarity >= 60 ? 'complementary' : 'similar',
        },
        power: {
            clarity: publicMatches.governance.match,
            mode: powerMode,
        },
        pace: {
            participantA: paceA,
            participantB: paceB,
            contrast: paceContrast,
            mode:
                paceContrast >= 30
                    ? 'mixed'
                    : (paceA + paceB) / 2 >= 60
                      ? 'aggressive'
                      : 'steady',
        },
    };
    const rankedTypes = rankPairTypes({
        axes,
        directionAlignment,
        capabilityComplementarity,
        understanding,
        visionExecutionSplit: splitScore(visionRoles, executionRoles),
        externalInternalSplit: splitScore(externalRoles, internalRoles),
        methodContrast: rounded(
            (publicMatches.differences.product +
                publicMatches.differences.operating) /
                2,
        ),
        autonomy: Math.min(100, (rolesA.length + rolesB.length) * 15),
        governanceMatch: publicMatches.governance.match,
        conflictMatch: publicMatches.conflict.match,
    });
    const identityScores = [
        { id: 'modifier.same-mountain', score: directionAlignment },
        { id: 'modifier.digital-twin', score: understanding },
        {
            id: 'modifier.dual-big-outcome',
            score: (safeValuesA.ambition + safeValuesB.ambition) / 2,
        },
        {
            id: 'modifier.dual-product',
            score:
                Number(rolesA.includes('product') && rolesB.includes('product')) *
                    50 +
                publicMatches.product.match / 2,
        },
        {
            id: 'modifier.cashflow-couple',
            score: 100 - (safeValuesA.money + safeValuesB.money) / 2,
        },
        {
            id: 'modifier.research-driven',
            score:
                Number(
                    hasAnyRole(rolesA, ['research', 'ai-models']) ||
                        hasAnyRole(rolesB, ['research', 'ai-models']),
                ) * 100,
        },
    ].sort((left, right) => right.score - left.score);
    const dynamicScores = [
        {
            id: 'modifier.quiet-reactive',
            score: Math.min(100, publicMatches.conflict.match < 70 ? 90 : 20),
        },
        {
            id: 'modifier.narrative-market-fit',
            score:
                Number(
                    tags.some(
                        (tag) =>
                            tag.includes('narrative') ||
                            tag === 'capital-orientation',
                    ),
                ) * 60 +
                splitScore(externalRoles, internalRoles) * 0.4,
        },
        {
            id: 'modifier.high-pressure-pair',
            score: (paceA + paceB) / 2,
        },
        {
            id: 'modifier.fight-and-return',
            score:
                publicMatches.conflict.match * 0.6 +
                ((safeValuesA.conflict + safeValuesB.conflict) / 2) * 0.4,
        },
        {
            id: 'modifier.story-and-delivery',
            score: splitScore(externalRoles, internalRoles),
        },
        {
            id: 'modifier.independent-founders',
            score: (100 - roleSimilarityScore) * 0.5 +
                Number(powerMode === 'dual_core') * 50,
        },
    ].sort((left, right) => right.score - left.score);
    const hasCenturyCompanyTrait =
        directionAlignment >= 90 &&
        publicMatches.governance.match >= 90 &&
        publicMatches.conflict.match >= 85 &&
        safeValuesA.ambition >= 65 &&
        safeValuesB.ambition >= 65 &&
        exactTotal >= 8 &&
        publicMirrorCounts.a.opposite + publicMirrorCounts.b.opposite === 0 &&
        flags.length === 0;

    return {
        axes,
        candidates: rankedTypes.slice(0, 3).map(({ id }) => id),
        forbidden: rankedTypes.slice(5).map(({ id }) => id),
        modifierCandidates: {
            identity: identityScores.slice(0, 3).map(({ id }) => id),
            dynamic: dynamicScores.slice(0, 3).map(({ id }) => id),
        },
        legendaryTraitId: hasCenturyCompanyTrait
            ? 'trait.century-company'
            : null,
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
    const safeBandsA = Object.fromEntries(
        DIMENSIONS.map((dimension) => [
            dimension,
            dimensionBand(safeValuesA[dimension]),
        ]),
    );
    const safeBandsB = Object.fromEntries(
        DIMENSIONS.map((dimension) => [
            dimension,
            dimensionBand(safeValuesB[dimension]),
        ]),
    );
    const safeDimensionGaps = Object.fromEntries(
        DIMENSIONS.map((dimension) => [
            dimension,
            Math.abs(safeValuesA[dimension] - safeValuesB[dimension]),
        ]),
    );
    const latencyA = conflictLatency(participantA.core);
    const latencyB = conflictLatency(participantB.core);
    const conflictLatencyGapDays = Math.abs(latencyA - latencyB);
    const mirrorA = mirrorOutcomes(participantA, participantB);
    const mirrorB = mirrorOutcomes(participantB, participantA);
    const publicMirrorCounts = (outcomes: ReturnType<typeof mirrorOutcomes>) => {
        const publicOutcomes = outcomes.outcomes.filter(
            ({ questionId }) => questionId !== 'Q1',
        );
        return {
            exact: publicOutcomes.filter(({ relation }) => relation === 'exact')
                .length,
            near: publicOutcomes.filter(({ relation }) => relation === 'near')
                .length,
            opposite: publicOutcomes.filter(
                ({ relation }) => relation === 'opposite',
            ).length,
        };
    };
    const matches = dimensionMatches(
        valuesA,
        valuesB,
        participantA.profile.companyAuthority,
        participantB.profile.companyAuthority,
        conflictLatencyGapDays,
    );
    const publicMatches = dimensionMatches(
        safeValuesA,
        safeValuesB,
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
        publicMatches,
        {
            a: publicMirrorCounts(mirrorA),
            b: publicMirrorCounts(mirrorB),
        },
        flags,
    );
    const publicTags = [
        ...new Set([
            ...collectTags(participantA.core),
            ...collectTags(participantB.core),
        ]),
    ];
    const relationRank: Record<MirrorRelation, number> = {
        exact: 0,
        near: 1,
        opposite: 2,
    };
    const publicMirrorQuestionIds = questionBank.mirror_question_ids.filter(
        (questionId) => questionId !== 'Q1',
    );
    const classificationSignals: ClassificationSignals = {
        dimensionsByLowestMatch: [...DIMENSIONS].sort(
            (left, right) => publicMatches[left].match - publicMatches[right].match,
        ),
        conflictFlagIdsByPriority: [...flags]
            .sort(
                (left, right) =>
                    severityRank(right.severity) - severityRank(left.severity),
            )
            .map(({ id }) => id),
        mirrorQuestionIdsByMisread: publicMirrorQuestionIds.sort((left, right) => {
            const score = (questionId: string) =>
                relationRank[
                    mirrorA.outcomes.find((item) => item.questionId === questionId)!
                        .relation
                ] +
                relationRank[
                    mirrorB.outcomes.find((item) => item.questionId === questionId)!
                        .relation
                ];
            return score(right) - score(left);
        }),
        unresolvedTopicsByPriority: sensitiveSignals
            .filter(({ state }) => state === 'unresolved')
            .map(({ topic }) => topic),
    };

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
            aPredictsB: mirrorA,
            bPredictsA: mirrorB,
        },
        conflictFlags: flags,
        sensitiveSignals,
        unresolvedTopics: sensitiveSignals
            .filter(({ state }) => state === 'unresolved')
            .map(({ topic }) => topic),
        classificationSignals,
        pairFeatureVector: {
            schema_version: PAIR_FEATURE_VECTOR_VERSION,
            participant_role_codes: {
                participant_a: [...participantA.profile.responsibilities].sort(),
                participant_b: [...participantB.profile.responsibilities].sort(),
            },
            participant_dimension_bands: {
                participant_a: safeBandsA,
                participant_b: safeBandsB,
            },
            dimension_match_scores: Object.fromEntries(
                DIMENSIONS.map((dimension) => [
                    dimension,
                    publicMatches[dimension].match,
                ]),
            ),
            dimension_gaps: safeDimensionGaps,
            authority_state: matches.authority.state,
            conflict_latency_gap_days: conflictLatencyGapDays,
            mirror_counts: {
                participant_a_predicts_b: publicMirrorCounts(mirrorA),
                participant_b_predicts_a: publicMirrorCounts(mirrorB),
            },
            ordinary_conflict_flag_codes: flags.map(({ id }) => id),
            narrative_tag_codes: publicTags,
            relationship_axes: candidateResult.axes,
        },
        publicFeatures: {
            rulesVersion: RULES_VERSION,
            participantBands: {
                a: safeBandsA,
                b: safeBandsB,
            },
            dimensionGaps: safeDimensionGaps,
            ordinaryConflictFlagIds: flags.map(({ id }) => id),
            tags: publicTags,
            publicArchetypeCandidates: candidateResult.candidates,
            forbiddenPublicArchetypes: candidateResult.forbidden,
            modifierCandidates: candidateResult.modifierCandidates,
            legendaryTraitId: candidateResult.legendaryTraitId,
            relationshipAxes: candidateResult.axes,
        },
        conservativeResult: {
            publicArchetypeId:
                candidateResult.candidates[0] || 'chopsticks',
        },
    };
};
