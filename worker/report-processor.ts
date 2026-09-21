import { contentLibraryV1 } from './content-library';
import {
    createJevClassifier,
    type ChoiceCandidateSet,
    type ClassificationDecision,
    type ClassificationRequest,
    type PairClassifier,
    TransientClassificationError,
} from './jev-classifier';
import type { PairTestState } from './pair-repository';
import {
    type PrivateReportFacts,
    type ReportRepository,
    type StoredPairResult,
} from './report-repository';
import {
    DIMENSIONS,
    derivePairRules,
    type Dimension,
    type RulesParticipant,
} from './rules';

const toRulesParticipant = (state: PairTestState): RulesParticipant => {
    if (!state.profile) throw new Error('Sealed participant has no profile');
    const section = (prefix: string) =>
        Object.fromEntries(
            Object.entries(state.answers)
                .filter(([key]) => key.startsWith(`${prefix}:`))
                .map(([key, value]) => [key.slice(prefix.length + 1), value]),
        );
    return {
        profile: state.profile,
        core: section('core'),
        mirror: section('mirror'),
        redLine: section('red-line'),
    };
};

type PairRules = ReturnType<typeof derivePairRules>;

const archetypeCriteria: Record<string, string> = {
    'archetype.vision-reality':
        'Different but useful vision and execution orientations.',
    'archetype.dual-big-outcome':
        'Both participants consistently favor large, long-term outcomes.',
    'archetype.dual-product':
        'Both participants have product in participant_role_codes and share a strong product or user-evidence orientation.',
    'archetype.cashflow-operators':
        'The Pair role codes and money pattern emphasize sales, finance, customer delivery, revenue, and sustainable operation.',
    'archetype.research-lab':
        'Research appears in participant_role_codes and the Pair has a meaningful technical exploration pattern.',
    'archetype.narrative-market-fit':
        'Role and narrative codes combine fundraising, marketing, BD, or public storytelling with operating evidence.',
    'archetype.complementary-monsters':
        'Participant role codes show unusually strong functional complement without multiple severe structural conflicts.',
    'archetype.complementary-builders':
        'Use when roles are broadly complementary but no specialized identity is clearly more defining.',
};

const riskPatternCriteria: Record<string, string> = {
    'risk.dual-leadership':
        'Both participants may expect final authority, creating competing command systems.',
    'risk.quiet-reactive':
        'Different conflict timing can turn silence into pressure and pressure into withdrawal.',
    'risk.high-pressure-pair':
        'The Pair may normalize urgency, overwork, and sustained operating pressure.',
    'risk.world-peace':
        'High apparent harmony may conceal disagreements that are not being surfaced.',
    'risk.parallel-solo-founders':
        'Both can execute independently, but shared context and joint decisions may be weak.',
};

const mirrorCriteria: Record<string, string> = {
    'mirror.accurate-model':
        'Both participants predict each other accurately with few opposite answers.',
    'mirror.near-but-fragile':
        'Most predictions are directionally near, but important boundaries remain unclear.',
    'mirror.opposite-assumptions':
        'Opposite predictions are the dominant or most consequential pattern.',
    'mirror.asymmetric-model':
        'One participant predicts the other substantially better than the reverse.',
};

const dimensionPromptTopics: Record<Dimension, string[]> = {
    ambition: ['five-year-definition'],
    risk: ['hiring-window', 'platform-overlap', 'risk-loss-aversion'],
    money: [
        'customer-customization',
        'founder-compensation',
        'cash-at-six-months',
        'runway-signal',
    ],
    product: ['user-demand', 'media-vs-usage', 'product-evidence'],
    governance: [
        'decision-deadlock',
        'company-authority',
        'authority-model',
        'repeated-bad-decisions',
    ],
    conflict: ['conflict-latency', 'conflict-style', 'unresolved-conflict'],
    operating: ['work-boundary', 'engineering-rigor', 'delayed-decision'],
    external: ['public-representation', 'customer-crisis'],
};

const flagPromptTopics: Record<string, string[]> = {
    'dual-sole-authority': ['company-authority', 'authority-model'],
    'safe-ambition-gap': ['five-year-definition'],
    'risk-gap': ['risk-loss-aversion', 'hiring-window'],
    'money-gap': ['cash-at-six-months', 'runway-signal'],
    'product-large-structural-difference': ['product-evidence', 'user-demand'],
    'conflict-latency-gap': ['conflict-latency', 'conflict-style'],
    'operating-gap': ['work-boundary', 'engineering-rigor'],
};

const mirrorPromptTopics: Record<string, string[]> = {
    Q4: ['hiring-window'],
    Q7: ['customer-customization'],
    Q13: ['decision-deadlock'],
    Q16: ['conflict-latency'],
    Q22: ['public-representation'],
};

const unresolvedPromptTopics: Record<string, string[]> = {
    'acquisition-intent': ['acquisition-threshold'],
    'equity-adjustment': ['equity-adjustment'],
    'commitment-horizon': ['commitment-horizon'],
    'ethics-boundary': ['ethics-boundary'],
    'ceo-removal': ['ceo-removal'],
};

const choiceSet = (
    ids: string[],
    criterion: (id: string) => string,
    fallback: string,
): ChoiceCandidateSet => ({
    criteria: Object.fromEntries(ids.map((id) => [id, criterion(id)])),
    fallback,
});

export const buildClassificationRequest = (
    rules: PairRules,
): ClassificationRequest => {
    const matches = rules.pairFeatureVector.dimension_match_scores;
    const gaps = rules.pairFeatureVector.dimension_gaps;
    const dimensionsByHighestMatch = [
        ...rules.classificationSignals.dimensionsByLowestMatch,
    ].reverse();
    const alignmentCandidates = dimensionsByHighestMatch.slice(0, 3);
    const complementCandidates = (['operating', 'external'] as Dimension[]).sort(
        (left, right) => matches[right] - matches[left],
    );
    const sortedFlags = rules.classificationSignals.conflictFlagIdsByPriority.map(
        (id) => rules.conflictFlags.find((flag) => flag.id === id)!,
    );
    const lowestDimensions =
        rules.classificationSignals.dimensionsByLowestMatch.slice(0, 3);
    const topRiskCandidates = [
        ...sortedFlags.map(({ id }) => `flag.${id}`),
        ...lowestDimensions.map((dimension) => `dimension.${dimension}`),
    ].slice(0, 5);
    const topRiskFallback = topRiskCandidates[0];
    const mirrorA = rules.pairFeatureVector.mirror_counts.participant_a_predicts_b;
    const mirrorB = rules.pairFeatureVector.mirror_counts.participant_b_predicts_a;
    const exactGap = Math.abs(mirrorA.exact - mirrorB.exact);
    const oppositeTotal = mirrorA.opposite + mirrorB.opposite;
    const nearTotal = mirrorA.near + mirrorB.near;
    const mirrorFallback =
        exactGap >= 2
            ? 'mirror.asymmetric-model'
            : oppositeTotal >= 3
              ? 'mirror.opposite-assumptions'
              : nearTotal >= 4
                ? 'mirror.near-but-fragile'
                : 'mirror.accurate-model';
    const riskFallback = sortedFlags.some(
        ({ id }) => id === 'dual-sole-authority',
    )
        ? 'risk.dual-leadership'
        : matches.conflict < 70
          ? 'risk.quiet-reactive'
          : 'risk.parallel-solo-founders';
    const promptTopics = [
        dimensionPromptTopics[lowestDimensions[0]],
        flagPromptTopics[rules.classificationSignals.conflictFlagIdsByPriority[0]],
        mirrorPromptTopics[rules.classificationSignals.mirrorQuestionIdsByMisread[0]],
        ['external-role'],
        unresolvedPromptTopics[
            rules.classificationSignals.unresolvedTopicsByPriority[0]
        ],
    ];
    const usedPromptIds = new Set<string>();
    let fallbackDimensionIndex = 1;
    const promptChoices = promptTopics.map((requestedTopics) => {
        let topics = requestedTopics;
        let prompts = topics
            ? contentLibraryV1.prompts.filter(
                  ({ id, topic }) =>
                      topics.includes(topic) && !usedPromptIds.has(id),
              )
            : [];
        while (prompts.length === 0) {
            const fallbackDimension =
                rules.classificationSignals.dimensionsByLowestMatch[
                    fallbackDimensionIndex
                ];
            fallbackDimensionIndex += 1;
            topics = dimensionPromptTopics[fallbackDimension];
            prompts = contentLibraryV1.prompts.filter(
                ({ id, topic }) =>
                    topics.includes(topic) && !usedPromptIds.has(id),
            );
        }
        prompts.forEach(({ id }) => usedPromptIds.add(id));
        return choiceSet(
            prompts.map(({ id }) => id),
            (id) => {
                const prompt = prompts.find((item) => item.id === id)!;
                return `${prompt.topic}: ${prompt.copy}`;
            },
            prompts[0].id,
        );
    }) as ClassificationRequest['choices']['conversationPrompts'];

    return {
        featureVector: rules.pairFeatureVector,
        choices: {
            publicArchetype: choiceSet(
                rules.publicFeatures.publicArchetypeCandidates.map(
                    (id) => `archetype.${id}`,
                ),
                (id) => archetypeCriteria[id],
                `archetype.${rules.conservativeResult.publicArchetypeId}`,
            ),
            strongestAlignment: choiceSet(
                alignmentCandidates,
                (dimension) =>
                    `${dimension}: match ${matches[dimension]}, gap ${gaps[dimension]}.`,
                alignmentCandidates[0],
            ),
            valuableComplement: choiceSet(
                complementCandidates,
                (dimension) =>
                    `${dimension}: complement match ${matches[dimension]}, gap ${gaps[dimension]}.`,
                complementCandidates[0],
            ),
            topRisk: choiceSet(
                topRiskCandidates,
                (id) => {
                    if (id.startsWith('flag.')) {
                        const flag = sortedFlags.find(
                            (item) => `flag.${item.id}` === id,
                        )!;
                        return `Rule-derived ${flag.severity} conflict flag in ${flag.dimension}: ${flag.id}.`;
                    }
                    const dimension = id.slice('dimension.'.length);
                    return `${dimension}: match ${matches[dimension]}, gap ${gaps[dimension]}.`;
                },
                topRiskFallback,
            ),
            mirrorMisread: choiceSet(
                Object.keys(mirrorCriteria),
                (id) => mirrorCriteria[id],
                mirrorFallback,
            ),
            privateRiskPattern: choiceSet(
                Object.keys(riskPatternCriteria),
                (id) => riskPatternCriteria[id],
                riskFallback,
            ),
            conversationPrompts: promptChoices,
        },
    };
};

export const processPairReport = async (
    repository: ReportRepository,
    pairId: string,
    options: {
        now?: () => Date;
        classifier?: PairClassifier;
    } = {},
): Promise<StoredPairResult> => {
    const now = options.now ?? (() => new Date());
    const existing = await repository.getResult(pairId);
    if (existing) return existing;
    const input = await repository.getInput(pairId);
    if (!input) throw new Error('Pair is not ready for report generation');

    const rules = derivePairRules(
        toRulesParticipant(input.creator.state),
        toRulesParticipant(input.partner.state),
    );
    const classificationInput = buildClassificationRequest(rules);
    let classification: ClassificationDecision;
    try {
        classification = await (
            options.classifier ?? createJevClassifier({})
        ).classify(classificationInput);
    } catch (error) {
        const retryDeadline =
            new Date(input.generationStartedAt).getTime() + 5 * 60 * 1000;
        if (
            error instanceof TransientClassificationError &&
            now().getTime() < retryDeadline
        ) {
            throw error;
        }
        classification = await createJevClassifier({}).classify(
            classificationInput,
        );
        classification.fallbackReason =
            error instanceof TransientClassificationError
                ? error.message
                : 'classifier_failure';
    }
    const vocabulary = contentLibraryV1.reportVocabulary;
    const dimensions = DIMENSIONS.map((dimension) => ({
        dimension,
        label: vocabulary.dimensions[dimension],
        participantBands: {
            a: rules.participants.a.bands[dimension],
            b: rules.participants.b.bands[dimension],
        },
        bandContent: {
            a: {
                label: contentLibraryV1.dimensionBands[dimension][
                    rules.participants.a.bands[dimension]
                ][0],
                copy: contentLibraryV1.dimensionBands[dimension][
                    rules.participants.a.bands[dimension]
                ][1],
            },
            b: {
                label: contentLibraryV1.dimensionBands[dimension][
                    rules.participants.b.bands[dimension]
                ][0],
                copy: contentLibraryV1.dimensionBands[dimension][
                    rules.participants.b.bands[dimension]
                ][1],
            },
        },
        match: rules.dimensions[dimension].match,
        relation: rules.dimensions[dimension].relation,
        relationLabel:
            vocabulary.relations[rules.dimensions[dimension].relation],
    }));
    const alignment = dimensions.find(
        ({ dimension }) => dimension === classification.alignmentDimension,
    )!;
    const complement = dimensions.find(
        ({ dimension }) => dimension === classification.complementDimension,
    )!;
    const flags = rules.classificationSignals.conflictFlagIdsByPriority
        .map((id) => rules.conflictFlags.find((flag) => flag.id === id)!)
        .map((flag) => ({
            ...flag,
            ...vocabulary.flags[flag.id as keyof typeof vocabulary.flags],
            severityLabel: vocabulary.severities[flag.severity],
            dimensionLabel: vocabulary.dimensions[flag.dimension],
        }));
    const sensitiveSignals = rules.sensitiveSignals.map((signal) => ({
        ...signal,
        topicLabel:
            vocabulary.sensitiveTopics[
                signal.topic as keyof typeof vocabulary.sensitiveTopics
            ],
        stateLabel: vocabulary.sensitiveStates[signal.state],
        severityLabel: signal.severity
            ? vocabulary.severities[signal.severity]
            : null,
    }));
    const topDifferenceModule = contentLibraryV1.reportModules.find(
        ({ id }) => id === 'report.top-difference',
    )!;
    const selectedFlag = classification.topRiskId.startsWith('flag.')
        ? flags.find(
              ({ id }) => `flag.${id}` === classification.topRiskId,
          )!
        : null;
    const selectedRiskDimension = classification.topRiskId.startsWith(
        'dimension.',
    )
        ? dimensions.find(
              ({ dimension }) =>
                  `dimension.${dimension}` === classification.topRiskId,
          )!
        : null;
    const topRisk = selectedFlag
        ? {
              kind: 'flag' as const,
              id: selectedFlag.id,
              severity: selectedFlag.severity,
              title: selectedFlag.title,
              copy: selectedFlag.copy,
          }
        : {
              kind: 'difference' as const,
              id: selectedRiskDimension!.dimension,
              severity: null,
              title: selectedRiskDimension!.label,
              copy: topDifferenceModule.copy,
          };
    const archetype = contentLibraryV1.publicArchetypes.find(
        ({ id }) => id === classification.publicArchetypeId,
    )!;
    const risk = contentLibraryV1.privateRiskPatterns.find(
        ({ id }) => id === classification.privateRiskPatternId,
    )!;
    const mirrorInterpretation = contentLibraryV1.mirrorMisreads.find(
        ({ id }) => id === classification.mirrorMisreadId,
    )!;
    const moduleFor = (id: string) =>
        contentLibraryV1.reportModules.find((item) => item.id === id)!;
    const alignmentModule = moduleFor('report.strongest-alignment');
    const complementModule = moduleFor('report.valuable-complement');
    const section = (id: string) => {
        const module = moduleFor(id);
        return { title: module.title, copy: module.copy };
    };
    const prompts = classification.promptIds.map((id) => {
        const prompt = contentLibraryV1.prompts.find((item) => item.id === id)!;
        return { id: prompt.id, copy: prompt.copy };
    });
    const footer = moduleFor('report.footer');
    const report: PrivateReportFacts = {
        versions: {
            questionSet: rules.questionSetVersion,
            rules: rules.rulesVersion,
            content: contentLibraryV1.version,
        },
        classification: {
            source: classification.source,
            provider: classification.provider,
            requestedModel: classification.requestedModel,
            responseModel: classification.responseModel,
            decisionSchemaVersion: classification.decisionSchemaVersion,
            probabilities: classification.probabilities,
            confidence: classification.confidence,
            selectedContentIds: classification.selectedContentIds,
            fallbackReason: classification.fallbackReason,
        },
        roles: { a: 'creator', b: 'partner' },
        portrait: {
            archetypeId: archetype.id,
            title: archetype.title,
            englishTitle: archetype.englishTitle,
            copy: archetype.explanation,
        },
        alignment: {
            dimension: alignment.dimension,
            moduleId: alignmentModule.id,
            title: alignmentModule.title,
            copy: alignmentModule.copy,
        },
        complement: {
            dimension: complement.dimension,
            moduleId: complementModule.id,
            title: complementModule.title,
            copy: complementModule.copy,
        },
        sections: {
            topDifference: section('report.top-difference'),
            dimensions: section('report.dimensions'),
            mirror: section('report.mirror'),
            flags: section('report.conflict-flags'),
            prompts: section('report.prompts'),
        },
        topRisk,
        privatePattern: {
            id: risk.id,
            title: risk.title,
            copy: risk.copy,
            action: risk.action,
        },
        dimensions,
        mirror: {
            interpretation: {
                id: mirrorInterpretation.id,
                title: mirrorInterpretation.title,
                copy: mirrorInterpretation.copy,
            },
            aPredictsB: {
                exact: rules.mirror.aPredictsB.exact,
                near: rules.mirror.aPredictsB.near,
                opposite: rules.mirror.aPredictsB.opposite,
            },
            bPredictsA: {
                exact: rules.mirror.bPredictsA.exact,
                near: rules.mirror.bPredictsA.near,
                opposite: rules.mirror.bPredictsA.opposite,
            },
        },
        conflictFlags: flags,
        sensitiveContext: {
            attribution: 'unattributed',
            signals: sensitiveSignals,
            unresolvedTopics: rules.unresolvedTopics,
        },
        prompts,
        disclaimer: { id: footer.id, copy: footer.copy },
    };
    return repository.commitResult({
        pairId,
        questionSetVersion: rules.questionSetVersion,
        rulesVersion: rules.rulesVersion,
        contentVersion: contentLibraryV1.version,
        report,
        createdAt: now().toISOString(),
    });
};
