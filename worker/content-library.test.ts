import { describe, expect, it } from 'bun:test';
import { contentLibraryV1, validateContentLibrary } from './content-library';

const copyLibrary = () =>
    structuredClone(contentLibraryV1) as unknown as typeof contentLibraryV1;

describe('Content Library v1 validation', () => {
    it('accepts the complete approved library', () => {
        const result = validateContentLibrary(contentLibraryV1);

        expect(result).toEqual({ valid: true, errors: [] });
        expect(contentLibraryV1.prompts.length).toBeGreaterThanOrEqual(40);
        expect(contentLibraryV1.publicArchetypes).toHaveLength(8);
        expect(contentLibraryV1.privateRiskPatterns).toHaveLength(5);
    });

    it('rejects duplicate IDs, unapproved and placeholder copy', () => {
        const library = copyLibrary() as any;
        library.commonCopy[0].id = library.reportModules[0].id;
        library.commonCopy[0].approval.status = 'draft';
        library.commonCopy[0].copy = 'TODO';

        const result = validateContentLibrary(library);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Content IDs must be unique');
        expect(
            result.errors.some((error) => error.includes('not approved')),
        ).toBe(true);
        expect(
            result.errors.some((error) => error.includes('placeholder')),
        ).toBe(true);
    });

    it('rejects missing topics and unresolved conservative references', () => {
        const library = copyLibrary() as any;
        library.prompts = library.prompts.filter(
            (prompt: { topic: string }) => prompt.topic !== 'ceo-removal',
        );
        library.conservativeResult.promptIds[0] = 'prompt.missing.1';

        const result = validateContentLibrary(library);

        expect(result.errors).toContain('Missing prompt topic ceo-removal');
        expect(result.errors).toContain(
            'Unresolved content reference prompt.missing.1',
        );
    });

    it('rejects missing or unreachable review modules', () => {
        const library = copyLibrary() as any;
        library.reportModules = library.reportModules.filter(
            ({ id }: { id: string }) => id !== 'report.mirror',
        );
        library.commonCopy.push({
            ...library.commonCopy[0],
            id: 'receipt.unreachable',
        });

        const result = validateContentLibrary(library);

        expect(result.errors).toContain('Missing report module report.mirror');
        expect(result.errors).toContain('Unexpected common copy ID');
    });

    it('rejects placeholder copy in dimension bands', () => {
        const library = copyLibrary() as any;
        library.dimensionBands.risk[2][1] = 'TODO';

        expect(validateContentLibrary(library).errors).toContain(
            'Library contains placeholder copy',
        );
    });
});
