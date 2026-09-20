import questionBank from '../docs/calibration/question-bank-v0.json';

export type AnswerSection = 'core' | 'mirror' | 'red-line';

export type PairProfile = {
    relationshipStages: string[];
    knownDuration: string;
    workedDuration: string;
    responsibilities: string[];
    companyAuthority: string;
};

export const QUESTION_SET_VERSION = questionBank.question_set_version;

const uniqueNonEmptyValues = (input: unknown, allowed: readonly string[]) =>
    Array.isArray(input) &&
    input.length > 0 &&
    input.every((value) => typeof value === 'string' && allowed.includes(value)) &&
    new Set(input).size === input.length;

export const validateProfile = (input: unknown): input is PairProfile => {
    if (!input || typeof input !== 'object') return false;
    const profile = input as Record<string, unknown>;

    return (
        uniqueNonEmptyValues(
            profile.relationshipStages,
            questionBank.profile.relationship_stages,
        ) &&
        typeof profile.knownDuration === 'string' &&
        questionBank.profile.durations.includes(profile.knownDuration) &&
        typeof profile.workedDuration === 'string' &&
        questionBank.profile.durations.includes(profile.workedDuration) &&
        uniqueNonEmptyValues(
            profile.responsibilities,
            questionBank.profile.responsibilities,
        ) &&
        typeof profile.companyAuthority === 'string' &&
        questionBank.profile.company_authority.includes(profile.companyAuthority)
    );
};

const questionsFor = (section: AnswerSection) => {
    if (section === 'red-line') return questionBank.red_line_questions;
    if (section === 'mirror') {
        return questionBank.questions.filter((question) =>
            questionBank.mirror_question_ids.includes(question.id),
        );
    }
    return questionBank.questions;
};

const isValidCurrentAnswer = (
    section: string,
    questionId: string,
    optionId: unknown,
): section is AnswerSection => {
    if (!['core', 'mirror', 'red-line'].includes(section)) return false;
    if (typeof optionId !== 'string') return false;
    const question = questionsFor(section as AnswerSection).find(
        ({ id }) => id === questionId,
    );

    return question?.options.some(({ id }) => id === optionId) === true;
};

const currentRequiredAnswerKeys = [
    ...questionBank.questions.map(({ id }) => `core:${id}`),
    ...questionBank.mirror_question_ids.map((id) => `mirror:${id}`),
    ...questionBank.red_line_questions.map(({ id }) => `red-line:${id}`),
];

export const publicQuestionnaire = {
    questionSetVersion: questionBank.question_set_version,
    profile: questionBank.profile,
    questions: questionBank.questions.map(({ id, dimension, prompt, options }) => ({
        id,
        dimension,
        prompt,
        options: options.map(({ id: optionId, text }) => ({ id: optionId, text })),
    })),
    mirrorQuestionIds: questionBank.mirror_question_ids,
    redLineQuestions: questionBank.red_line_questions.map(
        ({ id, topic, prompt, options }) => ({
            id,
            topic,
            prompt,
            options: options.map(({ id: optionId, text }) => ({ id: optionId, text })),
        }),
    ),
};

const questionnaireVersions = new Map([
    [
        QUESTION_SET_VERSION,
        {
            questionnaire: publicQuestionnaire,
            requiredAnswerKeys: currentRequiredAnswerKeys,
            isValidAnswer: isValidCurrentAnswer,
        },
    ],
]);

export const getQuestionnaireVersion = (version: string) =>
    questionnaireVersions.get(version);
