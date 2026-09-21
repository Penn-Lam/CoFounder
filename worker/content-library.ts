import questionBankJson from '../docs/calibration/question-bank-v0.json';
import { DIMENSIONS } from './rules';
import { contentLibraryV1 } from './content-library-v1';

type ValidationResult = { valid: boolean; errors: string[] };

const catalog = questionBankJson.classification_catalog;
const REQUIRED_REPORT_IDS = [
    'report.team-portrait',
    'report.strongest-alignment',
    'report.valuable-complement',
    'report.top-difference',
    'report.dimensions',
    'report.mirror',
    'report.conflict-flags',
    'report.prompts',
    'report.footer',
] as const;
const REQUIRED_COMMON_COPY_IDS = [
    'receipt.heading',
    'receipt.date-version',
    'receipt.cta',
    'tombstone.withdrawn',
    'tombstone.unpublished',
    'disclaimer.before-test',
    'disclaimer.private-report',
    'report.generating',
    'report.conservative',
] as const;

const itemCollections = (library: typeof contentLibraryV1) => [
    ...library.publicArchetypes,
    ...library.privateRiskPatterns,
    ...library.mirrorMisreads,
    library.reportVocabulary,
    ...library.reportModules,
    ...library.prompts,
    ...library.commonCopy,
    library.conservativeResult,
];

export const validateContentLibrary = (
    library: typeof contentLibraryV1,
): ValidationResult => {
    const errors: string[] = [];
    const items = itemCollections(library);
    const ids = items.map(({ id }) => id);
    const idSet = new Set(ids);
    const check = (condition: boolean, message: string) => {
        if (!condition) errors.push(message);
    };

    check(Boolean(library.version), 'Content version is required');
    check(library.status === 'human-final', 'Library must be human-final');
    check(idSet.size === ids.length, 'Content IDs must be unique');
    check(
        !/TODO|TBD|placeholder|lorem|待定|占位/i.test(JSON.stringify(library)),
        'Library contains placeholder copy',
    );

    for (const item of items) {
        check(
            item.approval.status === 'approved',
            `${item.id} is not approved`,
        );
        check(Boolean(item.approval.approvedBy), `${item.id} has no approver`);
        check(
            Boolean(item.approval.approvedAt),
            `${item.id} has no approval date`,
        );
        check(
            !/TODO|TBD|placeholder|lorem|待定|占位/i.test(JSON.stringify(item)),
            `${item.id} contains placeholder copy`,
        );
    }

    const archetypeKeys = new Set<string>(
        library.publicArchetypes.map(({ key }) => key),
    );
    const riskKeys = new Set<string>(
        library.privateRiskPatterns.map(({ key }) => key),
    );
    for (const { id } of catalog.public_archetypes) {
        check(archetypeKeys.has(id), `Missing allowed archetype ${id}`);
    }
    for (const { id } of catalog.private_risk_patterns) {
        check(riskKeys.has(id), `Missing allowed risk pattern ${id}`);
    }
    check(
        archetypeKeys.size === catalog.public_archetypes.length,
        'Unexpected public archetype',
    );
    check(
        riskKeys.size === catalog.private_risk_patterns.length,
        'Unexpected private risk pattern',
    );
    check(
        library.mirrorMisreads.length === 4,
        'Exactly four Mirror interpretations are required',
    );
    for (const archetype of library.publicArchetypes) {
        check(Boolean(archetype.title), `${archetype.id} has no Chinese title`);
        check(
            Boolean(archetype.englishTitle),
            `${archetype.id} has no English title`,
        );
        check(
            Boolean(archetype.explanation),
            `${archetype.id} has no explanation`,
        );
        check(
            archetype.safeTraits.length >= 3,
            `${archetype.id} needs three traits`,
        );
        check(
            archetype.teamQuotes.length >= 2,
            `${archetype.id} needs quote variants`,
        );
    }

    const checkRequiredIds = (
        required: readonly string[],
        actual: readonly string[],
        collection: string,
    ) => {
        const actualIds = new Set(actual);
        for (const id of required) {
            check(actualIds.has(id), `Missing ${collection} ${id}`);
        }
        check(
            actualIds.size === required.length,
            `Unexpected ${collection} ID`,
        );
    };
    checkRequiredIds(
        REQUIRED_REPORT_IDS,
        library.reportModules.map(({ id }) => id),
        'report module',
    );
    checkRequiredIds(
        REQUIRED_COMMON_COPY_IDS,
        library.commonCopy.map(({ id }) => id),
        'common copy',
    );

    const dimensions = Object.keys(library.dimensionBands);
    check(
        dimensions.length === DIMENSIONS.length &&
            DIMENSIONS.every((dimension) => dimensions.includes(dimension)),
        'All eight dimensions must be present',
    );
    for (const dimension of DIMENSIONS) {
        const bands = library.dimensionBands[dimension];
        check(bands.length === 5, `${dimension} must have five bands`);
        bands.forEach(([label, copy], index) => {
            check(
                Boolean(label && copy),
                `${dimension} band ${index} is incomplete`,
            );
        });
    }
    check(
        DIMENSIONS.every((dimension) =>
            Boolean(library.reportVocabulary.dimensions[dimension]),
        ),
        'Report vocabulary must label all dimensions',
    );
    for (const flag of [
        'dual-sole-authority',
        'safe-ambition-gap',
        'risk-gap',
        'money-gap',
        'product-large-structural-difference',
        'conflict-latency-gap',
        'operating-gap',
    ] as const) {
        check(
            Boolean(
                library.reportVocabulary.flags[flag].title &&
                library.reportVocabulary.flags[flag].copy,
            ),
            `Missing report vocabulary for ${flag}`,
        );
    }

    const topics = new Set(library.prompts.map(({ topic }) => topic));
    check(library.prompts.length >= 40, 'At least 40 prompts are required');
    for (const topic of catalog.conversation_prompt_topics) {
        check(topics.has(topic), `Missing prompt topic ${topic}`);
    }
    for (const topic of [
        'decision-deadlock',
        'company-authority',
        'authority-model',
        'conflict-latency',
        'conflict-style',
        'unresolved-conflict',
    ]) {
        check(
            library.prompts.filter((prompt) => prompt.topic === topic).length >=
                2,
            `${topic} needs multiple prompt variants`,
        );
    }

    const references = [
        library.conservativeResult.archetypeId,
        library.conservativeResult.riskPatternId,
        ...library.conservativeResult.reportModuleIds,
        ...library.conservativeResult.promptIds,
    ];
    for (const reference of references) {
        check(
            idSet.has(reference),
            `Unresolved content reference ${reference}`,
        );
    }

    const englishFields: string[] = [];
    const visit = (value: unknown, path: string) => {
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
            const childPath = `${path}.${key}`;
            if (
                /english/i.test(key) &&
                !childPath.includes('publicArchetypes')
            ) {
                englishFields.push(childPath);
            }
            visit(child, childPath);
        }
    };
    visit(library, 'library');
    check(
        englishFields.length === 0,
        `English display fields outside archetypes: ${englishFields.join(', ')}`,
    );

    return { valid: errors.length === 0, errors };
};

const validation = validateContentLibrary(contentLibraryV1);
if (!validation.valid) {
    throw new Error(
        `Invalid Content Library:\n${validation.errors.join('\n')}`,
    );
}

export { contentLibraryV1 };
