import { describe, expect, it } from 'bun:test';
import questionBank from '../docs/calibration/question-bank-v0.json';
import { processPairReport } from './report-processor';
import type {
    ReportInput,
    ReportRepository,
    StoredPairResult,
} from './report-repository';

const answersFor = () =>
    Object.fromEntries([
        ...questionBank.questions.map((question) => [
            `core:${question.id}`,
            question.options[0].id,
        ]),
        ...questionBank.mirror_question_ids.map((id) => {
            const question = questionBank.questions.find(
                (item) => item.id === id,
            )!;
            return [`mirror:${id}`, question.options[0].id];
        }),
        ...questionBank.red_line_questions.map((question) => [
            `red-line:${question.id}`,
            question.options[0].id,
        ]),
    ]);

const profile = {
    relationshipStages: ['side-project'],
    knownDuration: '1-3y',
    workedDuration: '3-12m',
    responsibilities: ['product'],
    companyAuthority: 'shared',
};

const input: ReportInput = {
    pairId: 'pair-1',
    creator: {
        userId: 'creator',
        questionSetVersion: questionBank.question_set_version,
        state: { profile, answers: answersFor() },
        submittedAt: '2026-09-20T12:00:00.000Z',
    },
    partner: {
        userId: 'partner',
        questionSetVersion: questionBank.question_set_version,
        state: { profile, answers: answersFor() },
        submittedAt: '2026-09-20T12:01:00.000Z',
    },
};

const harness = (failCommit = false) => {
    let stored: StoredPairResult | null = null;
    let commits = 0;
    const repository: ReportRepository = {
        async getResult() {
            return stored;
        },
        async getInput() {
            return input;
        },
        async commitResult(result) {
            commits += 1;
            if (failCommit) throw new Error('database unavailable');
            stored ||= structuredClone(result);
            return stored;
        },
        async getPendingJobs() {
            return [];
        },
        async markJobDispatched() {},
        async markJobCompleted() {},
    };
    return { repository, stored: () => stored, commits: () => commits };
};

describe('private report processor', () => {
    it('builds complete immutable facts without raw answers or aggregate scores', async () => {
        const test = harness();
        const result = await processPairReport(
            test.repository,
            input.pairId,
            () => new Date('2026-09-20T12:02:00.000Z'),
        );
        const serialized = JSON.stringify(result.report);

        expect(result.report.dimensions).toHaveLength(8);
        expect(result.report.prompts).toHaveLength(5);
        expect(result.report.sensitiveContext.attribution).toBe('unattributed');
        expect(result.report.versions).toEqual({
            questionSet: questionBank.question_set_version,
            rules: 'cofounder-rules-v1',
            content: 'cofounder-content-v1',
        });
        expect(serialized).not.toContain('core:Q1');
        expect(serialized).not.toContain('red-line:R1');
        expect(serialized).not.toMatch(/overall|aggregate|participant.*value/i);
    });

    it('returns the identical existing result on duplicate delivery', async () => {
        const test = harness();
        const first = await processPairReport(test.repository, input.pairId);
        const second = await processPairReport(test.repository, input.pairId);

        expect(second).toEqual(first);
        expect(test.commits()).toBe(1);
    });

    it('does not mutate source answers when result persistence fails', async () => {
        const test = harness(true);
        const before = structuredClone(input);

        await expect(
            processPairReport(test.repository, input.pairId),
        ).rejects.toThrow('database unavailable');
        expect(input).toEqual(before);
        expect(input.creator.state.answers['core:Q1']).toBeDefined();
        expect(input.partner.state.answers['red-line:R4']).toBeDefined();
    });
});
