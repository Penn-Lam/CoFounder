import React, { useEffect, useState } from 'react';
import ReceiptPrinterOverlay, { PublicResult } from './ReceiptPrinterOverlay';

const PublicResultPage: React.FC<{ slug: string }> = ({ slug }) => {
    const [result, setResult] = useState<PublicResult | null>(null);
    const [unavailable, setUnavailable] = useState(false);

    useEffect(() => {
        fetch(`/api/public-results/${encodeURIComponent(slug)}`)
            .then(async (response) => {
                if (!response.ok) throw new Error('unavailable');
                return response.json() as Promise<PublicResult>;
            })
            .then(setResult)
            .catch(() => setUnavailable(true));
    }, [slug]);

    if (unavailable) {
        return (
            <main className="public-result-unavailable">
                <div className="unavailable-receipt">
                    <strong>COFOUNDER RECEIPT</strong>
                    <h1>这张结果已不可用</h1>
                    <p>它可能已被任一参与者撤回，或分享链接已经更换。</p>
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
