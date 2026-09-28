import React, { useEffect, useState } from 'react';

type ReviewLibrary = {
    version: string;
    publicArchetypes: Array<{
        id: string;
        title: string;
        englishTitle: string;
        tagline: string;
        explanation: string;
        story: {
            title: string;
            paragraphs: readonly string[];
            image: string;
            receiptImage: string;
        };
    }>;
    modifiers: Array<{ id: string; group: string; label: string }>;
    legendaryTraits: Array<{ id: string; title: string; copy: string }>;
    privateRiskPatterns: Array<{
        id: string;
        title: string;
        copy: string;
        action: string;
    }>;
    mirrorMisreads: Array<{ id: string; title: string; copy: string }>;
    dimensionBands: Record<string, Array<[string, string]>>;
    reportModules: Array<{ id: string; title: string; copy: string }>;
    prompts: Array<{ id: string; topic: string; copy: string }>;
    commonCopy: Array<{ id: string; title: string; copy: string }>;
    conservativeResult: {
        id: string;
        pairTypeId: string;
        riskPatternId: string;
    };
};

const ContentReview: React.FC = () => {
    const [library, setLibrary] = useState<ReviewLibrary | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/content-library/v1/review')
            .then(async (response) => {
                if (!response.ok) throw new Error('内容库载入失败。');
                return response.json() as Promise<ReviewLibrary>;
            })
            .then(setLibrary)
            .catch((caught) =>
                setError(
                    caught instanceof Error
                        ? caught.message
                        : '内容库载入失败。',
                ),
            );
    }, []);

    if (error)
        return (
            <div className="pair-save-error" role="alert">
                {error}
            </div>
        );
    if (!library) return <p role="status">正在载入 Content Library…</p>;

    return (
        <article className="content-review">
            <header>
                <h1>Content Library</h1>
                <p>{library.version} · HUMAN FINAL · APPROVED</p>
            </header>
            <section>
                <h2>Public Archetypes</h2>
                <div className="review-grid">
                    {library.publicArchetypes.map((item) => (
                        <article className="review-card" key={item.id}>
                            <code>{item.id}</code>
                            <h3>{item.title}</h3>
                            <p className="review-secondary">
                                {item.englishTitle}
                            </p>
                            <blockquote>{item.tagline}</blockquote>
                            <p>{item.explanation}</p>
                            <img src={item.story.image} alt={item.story.title} />
                            <strong>{item.story.title}</strong>
                            {item.story.paragraphs.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                        </article>
                    ))}
                </div>
            </section>
            <section>
                <h2>Modifiers and Legendary Traits</h2>
                <div className="review-grid">
                    {library.modifiers.map((item) => (
                        <article className="review-card" key={item.id}>
                            <code>{item.id}</code>
                            <h3>{item.label}</h3>
                            <p>{item.group}</p>
                        </article>
                    ))}
                    {library.legendaryTraits.map((item) => (
                        <article className="review-card" key={item.id}>
                            <code>{item.id}</code>
                            <h3>{item.title}</h3>
                            <p>{item.copy}</p>
                        </article>
                    ))}
                </div>
            </section>
            <section>
                <h2>Private Risk Patterns</h2>
                <div className="review-grid">
                    {library.privateRiskPatterns.map((item) => (
                        <article className="review-card" key={item.id}>
                            <code>{item.id}</code>
                            <h3>{item.title}</h3>
                            <p>{item.copy}</p>
                            <strong>建议动作</strong>
                            <p>{item.action}</p>
                        </article>
                    ))}
                </div>
            </section>
            <section>
                <h2>Eight-dimension Bands</h2>
                {Object.entries(library.dimensionBands).map(
                    ([dimension, bands]) => (
                        <div className="band-row" key={dimension}>
                            <h3>{dimension}</h3>
                            {bands.map(([label, copy], index) => (
                                <article className="review-card" key={label}>
                                    <code>BAND {index + 1}</code>
                                    <h4>{label}</h4>
                                    <p>{copy}</p>
                                </article>
                            ))}
                        </div>
                    ),
                )}
            </section>
            <section>
                <h2>Mirror Interpretations</h2>
                <div className="review-grid">
                    {library.mirrorMisreads.map((item) => (
                        <article className="review-card" key={item.id}>
                            <code>{item.id}</code>
                            <h3>{item.title}</h3>
                            <p>{item.copy}</p>
                        </article>
                    ))}
                </div>
            </section>
            <section>
                <h2>Conservative Report</h2>
                <article className="review-card">
                    <code>{library.conservativeResult.id}</code>
                    <p>PAIR TYPE: {library.conservativeResult.pairTypeId}</p>
                    <p>PRIVATE: {library.conservativeResult.riskPatternId}</p>
                </article>
                <div className="review-grid">
                    {library.reportModules.map((item) => (
                        <article className="review-card" key={item.id}>
                            <code>{item.id}</code>
                            <h3>{item.title}</h3>
                            <p>{item.copy}</p>
                        </article>
                    ))}
                </div>
            </section>
            <section>
                <h2>Conversation Prompts ({library.prompts.length})</h2>
                <ol className="prompt-list">
                    {library.prompts.map((item) => (
                        <li key={item.id}>
                            <code>{item.id}</code>
                            <small>{item.topic}</small>
                            <p>{item.copy}</p>
                        </li>
                    ))}
                </ol>
            </section>
            <section>
                <h2>Receipt, Tombstone &amp; Disclaimer / Report Copy</h2>
                <div className="review-grid">
                    {library.commonCopy.map((item) => (
                        <article className="review-card" key={item.id}>
                            <code>{item.id}</code>
                            <h3>{item.title}</h3>
                            <p>{item.copy}</p>
                        </article>
                    ))}
                </div>
            </section>
        </article>
    );
};

export default ContentReview;
