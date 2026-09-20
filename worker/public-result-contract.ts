export type PublicResult = {
    status: 'published';
    names: { creator: string; partner: string };
    archetype: {
        title: string;
        englishTitle: string;
        explanation: string;
    };
    teamQuote: string;
    safeTraits: string[];
    date: string;
    versions: { questionSet: string; rules: string; content: string };
    cta: string;
};
