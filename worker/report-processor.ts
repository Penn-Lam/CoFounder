import { contentLibraryV1 } from './content-library';
import {
    createJevClassifier,
    type ClassificationDecision,
    type PairClassifier,
    TransientClassificationError,
} from './jev-classifier';
import type { PairTestState } from './pair-repository';
import {
    type PrivateReportFacts,
    type ReportRepository,
    type StoredPairResult,
} from './report-repository';
import { DIMENSIONS, derivePairRules, type RulesParticipant } from './rules';

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

const severityRank = (severity: string | null) =>
    severity === 'critical'
        ? 3
        : severity === 'high'
          ? 2
          : severity === 'moderate'
            ? 1
            : 0;

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
    const classificationInput = {
        featureVector: rules.pairFeatureVector,
        publicArchetypeCandidates:
            rules.publicFeatures.publicArchetypeCandidates,
        forbiddenPublicArchetypes:
            rules.publicFeatures.forbiddenPublicArchetypes,
        conservativePublicArchetypeId:
            rules.conservativeResult.publicArchetypeId,
    };
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
    const alignment = [...dimensions].sort((a, b) => b.match - a.match)[0];
    const complement = [...dimensions]
        .filter(
            ({ dimension }) =>
                dimension === 'operating' || dimension === 'external',
        )
        .sort((a, b) => b.match - a.match)[0];
    const flags = [...rules.conflictFlags]
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
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
    const unresolved = sensitiveSignals.find(
        ({ state }) => state === 'unresolved',
    );
    const topDifference = [...dimensions].sort((a, b) => a.match - b.match)[0];
    const topDifferenceModule = contentLibraryV1.reportModules.find(
        ({ id }) => id === 'report.top-difference',
    )!;
    const topRisk = flags[0]
        ? {
              kind: 'flag' as const,
              id: flags[0].id,
              severity: flags[0].severity,
              title: flags[0].title,
              copy: flags[0].copy,
          }
        : unresolved
          ? {
                kind: 'unresolved' as const,
                id: unresolved.topic,
                severity: null,
                title: unresolved.topicLabel,
                copy: unresolved.stateLabel,
            }
          : {
                kind: 'difference' as const,
                id: topDifference.dimension,
                severity: null,
                title: topDifference.label,
                copy: topDifferenceModule.copy,
            };
    const archetypeKey = classification.publicArchetypeId;
    const archetype = contentLibraryV1.publicArchetypes.find(
        ({ key }) => key === archetypeKey,
    )!;
    const riskKey = flags.some(({ id }) => id === 'dual-sole-authority')
        ? 'dual-leadership'
        : rules.dimensions.conflict.match < 70
          ? 'quiet-reactive'
          : 'parallel-solo-founders';
    const risk = contentLibraryV1.privateRiskPatterns.find(
        ({ key }) => key === riskKey,
    )!;
    const moduleFor = (id: string) =>
        contentLibraryV1.reportModules.find((item) => item.id === id)!;
    const alignmentModule = moduleFor('report.strongest-alignment');
    const complementModule = moduleFor('report.valuable-complement');
    const section = (id: string) => {
        const module = moduleFor(id);
        return { title: module.title, copy: module.copy };
    };
    const prompts = contentLibraryV1.conservativeResult.promptIds.map((id) => {
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
