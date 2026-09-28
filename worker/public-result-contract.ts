export type PublicResult = {
    status: 'published';
    names: { creator: string; partner: string };
    pairType: {
        title: string;
        englishTitle: string;
        tagline: string;
        explanation: string;
        image: string;
    };
    modifiers: string[];
    legendaryTrait: { title: string; copy: string } | null;
    date: string;
    versions: { questionSet: string; rules: string; content: string };
    cta: string;
};
