import React, { useEffect, useState } from 'react';
import ReceiptPrinterOverlay, { PublicResult } from './ReceiptPrinterOverlay';

const PublicResultPage: React.FC<{ slug: string }> = ({ slug }) => {
    const [result, setResult] = useState<PublicResult | null>(null);
    const [emptyState, setEmptyState] = useState<'withdrawn' | 'unavailable' | null>(null);

    useEffect(() => {
        fetch(`/api/public-results/${encodeURIComponent(slug)}`)
            .then(async (response) => {
                if (response.status === 410) {
                    setEmptyState('withdrawn');
                    return null;
                }
                if (!response.ok) throw new Error('unavailable');
                return response.json() as Promise<PublicResult>;
            })
            .then((nextResult) => nextResult && setResult(nextResult))
            .catch(() => setEmptyState('unavailable'));
    }, [slug]);

    if (emptyState) {
        return (
            <main className="public-result-unavailable">
                <div className="unavailable-receipt">
                    <strong>COFOUNDER RECEIPT</strong>
                    <h1>{emptyState === 'withdrawn' ? '这张结果已撤回' : '这张结果已不可用'}</h1>
                    <p>
                        {emptyState === 'withdrawn'
                            ? '任一参与者都可以撤回共同结果；这里不会保留任何身份或答案。'
                            : '分享链接可能已经更换，或从未存在。'}
                    </p>
                    <a href="/desktop">开始你们的 Cofounder 测试</a>
                </div>
            </main>
        );
    }

    if (!result) {
        return <main className="public-result-loading" role="status">正在读取 Receipt…</main>;
    }

    return <ReceiptPrinterOverlay result={result} publicPath={`/r/${slug}`} />;
};

export default PublicResultPage;
