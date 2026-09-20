import { describe, expect, it } from 'bun:test';
import questionBank from '../docs/calibration/question-bank-v0.json';
import {
    DIMENSIONS,
    authorityAgreement,
    derivePairRules,
    dimensionBand,
    dimensionMatches,
    mirrorRelation,
    ordinaryConflictFlags,
    participantDimensionValues,
    sensitiveSignalFor,
    type Dimension,
    type RulesParticipant,
} from './rules';

const profile = {
    relationshipStages: ['side-project'],
    knownDuration: '1-3y',
    workedDuration: '3-12m',
    responsibilities: ['product'],
    companyAuthority: 'shared',
};

const defaultCore = Object.fromEntries(
    questionBank.questions.map((question) => [
        question.id,
        question.options[0].id,
    ]),
);
const defaultMirror = Object.fromEntries(
    questionBank.mirror_question_ids.map((id) => [id, defaultCore[id]]),
);
const defaultRedLine = Object.fromEntries(
    questionBank.red_line_questions.map((question) => [
        question.id,
        question.options[0].id,
    ]),
);

const participant = (
    overrides: Partial<RulesParticipant> & {
        core?: Record<string, string>;
        mirror?: Record<string, string>;
        redLine?: Record<string, string>;
    } = {},
): RulesParticipant => ({
    profile: { ...profile, ...overrides.profile },
    core: { ...defaultCore, ...overrides.core },
    mirror: { ...defaultMirror, ...overrides.mirror },
    redLine: { ...defaultRedLine, ...overrides.redLine },
});

const values = (overrides: Partial<Record<Dimension, number>> = {}) =>
    Object.fromEntries(
        DIMENSIONS.map((dimension) => [dimension, overrides[dimension] ?? 50]),
    ) as Record<Dimension, number>;

type BoundaryFixture = { name: string; run(): void };
const boundaryFixtures: BoundaryFixture[] = [];

for (const dimension of ['ambition', 'money'] as const) {
    for (const [difference, expected] of [
        [0, 100],
        [1, 99],
        [99, 1],
        [100, 0],
    ] as const) {
        boundaryFixtures.push({
            name: `${dimension} consensus difference ${difference}`,
            run() {
                const result = dimensionMatches(
                    values({ [dimension]: 0 }),
                    values({ [dimension]: difference }),
                    'shared',
                    'shared',
                );
                expect(result[dimension].match).toBe(expected);
            },
        });
    }
}

for (const dimension of ['operating', 'external'] as const) {
    for (const [difference, expected] of [
        [0, 55],
        [10, 55],
        [11, 75],
        [25, 75],
        [26, 100],
        [55, 100],
        [56, 80],
        [70, 80],
        [71, 55],
    ] as const) {
        boundaryFixtures.push({
            name: `${dimension} complement difference ${difference}`,
            run() {
                const left = dimension === 'external' ? 100 : 0;
                const right =
                    dimension === 'external' ? 100 - difference : difference;
                const result = dimensionMatches(
                    values({ [dimension]: left }),
                    values({ [dimension]: right }),
                    'shared',
                    'shared',
                );
                expect(result[dimension].match).toBe(expected);
            },
        });
    }
}

for (const dimension of ['risk', 'conflict'] as const) {
    for (const [difference, expected] of [
        [0, 100],
        [15, 100],
        [16, 99],
        [50, 50],
        [84, 1],
        [85, 0],
        [100, 0],
    ] as const) {
        boundaryFixtures.push({
            name: `${dimension} threshold difference ${difference}`,
            run() {
                const result = dimensionMatches(
                    values({ [dimension]: 0 }),
                    values({ [dimension]: difference }),
                    'shared',
                    'shared',
                );
                expect(result[dimension].match).toBe(expected);
            },
        });
    }
}

const productCases = [
    {
        name: 'aligned zero',
        gap: 0,
        authority: ['shared', 'shared'],
        conflictGap: 0,
        relation: 'aligned',
        match: 100,
    },
    {
        name: 'aligned edge',
        gap: 25,
        authority: ['shared', 'shared'],
        conflictGap: 0,
        relation: 'aligned',
        match: 75,
    },
    {
        name: 'tension lower edge',
        gap: 26,
        authority: ['shared', 'shared'],
        conflictGap: 0,
        relation: 'productive_tension',
        match: 90,
    },
    {
        name: 'tension upper edge',
        gap: 55,
        authority: ['shared', 'shared'],
        conflictGap: 0,
        relation: 'productive_tension',
        match: 90,
    },
    {
        name: 'large structural edge',
        gap: 56,
        authority: ['shared', 'shared'],
        conflictGap: 0,
        relation: 'structural_difference',
        match: 44,
    },
    {
        name: 'maximum structural',
        gap: 100,
        authority: ['shared', 'shared'],
        conflictGap: 0,
        relation: 'structural_difference',
        match: 0,
    },
    {
        name: 'unhealthy governance',
        gap: 26,
        authority: ['self', 'self'],
        conflictGap: 0,
        relation: 'structural_difference',
        match: 45,
    },
    {
        name: 'unhealthy conflict',
        gap: 55,
        authority: ['shared', 'shared'],
        conflictGap: 50,
        relation: 'structural_difference',
        match: 45,
    },
    {
        name: 'latency flag',
        gap: 26,
        authority: ['shared', 'shared'],
        conflictGap: 0,
        latencyGap: 14,
        relation: 'structural_difference',
        match: 45,
    },
] as const;

for (const testCase of productCases) {
    boundaryFixtures.push({
        name: `product ${testCase.name}`,
        run() {
            const result = dimensionMatches(
                values({ product: 0, conflict: 0 }),
                values({
                    product: testCase.gap,
                    conflict: testCase.conflictGap,
                }),
                testCase.authority[0],
                testCase.authority[1],
                'latencyGap' in testCase ? testCase.latencyGap : 0,
            );
            expect(result.product).toEqual({
                relation: testCase.relation,
                match: testCase.match,
            });
        },
    });
}

for (const testCase of [
    { name: 'shared', a: 'shared', b: 'shared', gap: 0, expected: 100 },
    { name: 'same A', a: 'self', b: 'partner', gap: 0, expected: 100 },
    { name: 'same B', a: 'partner', b: 'self', gap: 0, expected: 100 },
    { name: 'shared and sole', a: 'shared', b: 'self', gap: 0, expected: 76 },
    {
        name: 'undefined cap',
        a: 'undefined',
        b: 'shared',
        gap: 0,
        expected: 65,
    },
    { name: 'dual claim cap', a: 'self', b: 'self', gap: 0, expected: 25 },
    {
        name: 'mutual delegation',
        a: 'partner',
        b: 'partner',
        gap: 0,
        expected: 40,
    },
    {
        name: 'undefined low preference',
        a: 'undefined',
        b: 'shared',
        gap: 100,
        expected: 30,
    },
] as const) {
    boundaryFixtures.push({
        name: `governance ${testCase.name}`,
        run() {
            const result = dimensionMatches(
                values({ governance: 0 }),
                values({ governance: testCase.gap }),
                testCase.a,
                testCase.b,
            );
            expect(result.governance.match).toBe(testCase.expected);
        },
    });
}

for (const [value, expected] of [
    [0, 0],
    [20, 0],
    [21, 1],
    [40, 1],
    [41, 2],
    [60, 2],
    [61, 3],
    [80, 3],
    [81, 4],
    [100, 4],
] as const) {
    boundaryFixtures.push({
        name: `band ${value}`,
        run() {
            expect(dimensionBand(value)).toBe(expected);
        },
    });
}

const flagBoundaries = [
    {
        id: 'safe-ambition-gap',
        field: 'safeAmbitionGap',
        below: 59,
        boundary: 60,
    },
    { id: 'risk-gap', field: 'riskGap', below: 59, boundary: 60 },
    { id: 'money-gap', field: 'moneyGap', below: 59, boundary: 60 },
    {
        id: 'product-large-structural-difference',
        field: 'productGap',
        below: 55,
        boundary: 56,
    },
    {
        id: 'conflict-latency-gap',
        field: 'conflictLatencyGapDays',
        below: 13.5,
        boundary: 14,
    },
    { id: 'operating-gap', field: 'operatingGap', below: 69, boundary: 70 },
] as const;

const flagInput = {
    authorityState: 'same_decision_maker' as const,
    safeAmbitionGap: 0,
    riskGap: 0,
    moneyGap: 0,
    productGap: 0,
    productRelation: 'structural_difference' as const,
    conflictLatencyGapDays: 0,
    operatingGap: 0,
};

for (const flag of flagBoundaries) {
    for (const [label, value, fires] of [
        ['below', flag.below, false],
        ['boundary', flag.boundary, true],
    ] as const) {
        boundaryFixtures.push({
            name: `${flag.id} ${label}`,
            run() {
                const ids = ordinaryConflictFlags({
                    ...flagInput,
                    [flag.field]: value,
                }).map(({ id }) => id);
                expect(ids.includes(flag.id)).toBe(fires);
            },
        });
    }
}

boundaryFixtures.push(
    {
        name: 'dual authority immediately below',
        run() {
            expect(
                ordinaryConflictFlags({
                    ...flagInput,
                    authorityState: 'different_sole',
                }).some(({ id }) => id === 'dual-sole-authority'),
            ).toBe(false);
        },
    },
    {
        name: 'dual authority boundary',
        run() {
            expect(
                ordinaryConflictFlags({
                    ...flagInput,
                    authorityState: 'dual_self_claim',
                }).some(({ id }) => id === 'dual-sole-authority'),
            ).toBe(true);
        },
    },
);

describe('versioned Rules boundary', () => {
    it('calculates weighted Participant values and ignores tag-only questions', () => {
        const result = participantDimensionValues({
            ...defaultCore,
            Q7: 'A',
            Q8: 'D',
            Q9: 'B',
            Q16: 'A',
            Q17: 'E',
            Q18: 'A',
        });

        expect(result.money).toBe(21);
        expect(result.conflict).toBe(98);
    });

    it(`runs ${boundaryFixtures.length} deliberately asymmetric boundary fixtures`, () => {
        expect(boundaryFixtures.length).toBeGreaterThanOrEqual(60);
        for (const fixture of boundaryFixtures) fixture.run();
    });

    it('normalizes authority into actual Participants', () => {
        expect(authorityAgreement('self', 'partner')).toEqual({
            agreement: 100,
            state: 'same_decision_maker',
        });
        expect(authorityAgreement('self', 'self').state).toBe(
            'dual_self_claim',
        );
        expect(authorityAgreement('partner', 'partner').state).toBe(
            'different_sole',
        );
    });

    it('classifies every Mirror option pair exactly once', () => {
        for (const matrix of questionBank.mirror_relationships) {
            const question = questionBank.questions.find(
                ({ id }) => id === matrix.question_id,
            )!;
            for (const predicted of question.options) {
                for (const actual of question.options) {
                    const relation = mirrorRelation(
                        matrix.question_id,
                        predicted.id,
                        actual.id,
                    );
                    expect(['exact', 'near', 'opposite']).toContain(relation);
                    const key = [predicted.id, actual.id].sort().join(':');
                    const occurrences = [
                        ...matrix.near_pairs,
                        ...matrix.opposite_pairs,
                    ].filter(
                        (pair) => [...pair].sort().join(':') === key,
                    ).length;
                    expect(occurrences).toBe(
                        predicted.id === actual.id ? 0 : 1,
                    );
                }
            }
        }
    });

    it('classifies every Q1 and Red Line Pair state', () => {
        const sensitiveQuestions = [
            questionBank.questions.find(({ id }) => id === 'Q1')!,
            ...questionBank.red_line_questions,
        ];
        for (const question of sensitiveQuestions) {
            for (const optionA of question.options) {
                for (const optionB of question.options) {
                    const signal = sensitiveSignalFor(
                        question.id,
                        optionA.id,
                        optionB.id,
                    );
                    expect(['aligned', 'conflict', 'unresolved']).toContain(
                        signal.state,
                    );
                    if (signal.state === 'conflict') {
                        expect(['high', 'critical']).toContain(signal.severity);
                        const expected =
                            question.id === 'Q1'
                                ? questionBank.sensitive_core_relationships[0].conflict_pairs.find(
                                      ({ options }) =>
                                          [...options].sort().join(':') ===
                                          [optionA.id, optionB.id]
                                              .sort()
                                              .join(':'),
                                  )?.severity
                                : questionBank.red_line_relationships.find(
                                      ({ question_id }) =>
                                          question_id === question.id,
                                  )?.conflict_severity;
                        expect(signal.severity).toBe(expected);
                    }
                }
            }
        }
    });

    it('never creates an External flag from distance alone', () => {
        const flags = ordinaryConflictFlags(flagInput);
        expect(flags.some(({ dimension }) => dimension === 'external')).toBe(
            false,
        );
    });

    it('excludes Q1 and Red Line evidence from public features', () => {
        const baseline = derivePairRules(participant(), participant());
        const sensitiveDifference = derivePairRules(
            participant({
                core: { Q1: 'A' },
                redLine: { R1: 'A', R2: 'A', R3: 'A', R4: 'A' },
            }),
            participant({
                core: { Q1: 'C' },
                redLine: { R1: 'C', R2: 'D', R3: 'C', R4: 'C' },
            }),
        );

        expect(sensitiveDifference.publicFeatures).toEqual(
            baseline.publicFeatures,
        );
        expect(
            sensitiveDifference.sensitiveSignals.some(
                ({ state }) => state === 'conflict',
            ),
        ).toBe(true);
    });

    it('returns three to five bounded public candidates and a deterministic fallback', () => {
        const result = derivePairRules(participant(), participant());

        expect(
            result.publicFeatures.publicArchetypeCandidates.length,
        ).toBeGreaterThanOrEqual(3);
        expect(
            result.publicFeatures.publicArchetypeCandidates.length,
        ).toBeLessThanOrEqual(5);
        expect(result.publicFeatures.publicArchetypeCandidates).toContain(
            result.conservativeResult.publicArchetypeId,
        );
    });

    it('is pure and does not mutate sealed inputs', () => {
        const a = participant();
        const b = participant({ core: { Q2: 'D', Q3: 'D' } });
        const before = JSON.stringify({ a, b });

        derivePairRules(a, b);

        expect(JSON.stringify({ a, b })).toBe(before);
    });
});
