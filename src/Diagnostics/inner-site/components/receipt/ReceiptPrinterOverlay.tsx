import { ShareNetwork, X } from '@phosphor-icons/react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import React, { useEffect, useRef, useState } from 'react';
import { ReceiptPrinter, ReceiptPrinterStage } from './ReceiptPrinter';
import type { PublicResult } from '../../../../../worker/public-result-contract';

export type { PublicResult } from '../../../../../worker/public-result-contract';

export const PRINT_RECEIPT_EVENT = 'cofounder:print-receipt';

export type PrintReceiptDetail = {
    result: PublicResult;
    publicPath: string;
};

type ReceiptPrinterOverlayProps = PrintReceiptDetail & {
    onClose?: () => void;
};

const HOME_URL = '/';
const LOGO_URL = '/images/receipt-printer-logo.png';

const downloadUrl = (url: string, filename: string) => {
    const anchor = document.createElement('a');
    anchor.download = filename;
    anchor.href = url;
    anchor.click();
};

const isCoarsePointer = () =>
    window.matchMedia('(pointer: coarse)').matches;

const ReceiptContent: React.FC<{ result: PublicResult; qrCode: string }> = ({
    result,
    qrCode,
}) => (
    <>
        <img className="receipt-logo receipt-logo-paper" src={LOGO_URL} alt="" aria-hidden="true" />
        <p className="receipt-kicker">COFOUNDER IDENTITY RECEIPT</p>
        <h1>{result.names.creator} × {result.names.partner}</h1>
        <div className="receipt-rule" />
        <h2>{result.archetype.title}</h2>
        <p className="receipt-english-title">{result.archetype.englishTitle}</p>
        <p>{result.archetype.explanation}</p>
        <blockquote>{result.teamQuote}</blockquote>
        <dl className="receipt-traits">
            {result.safeTraits.map((trait, index) => (
                <div key={trait}>
                    <dt>0{index + 1}</dt>
                    <dd>{trait}</dd>
                </div>
            ))}
        </dl>
        <div className="receipt-rule" />
        <p className="receipt-cta">{result.cta}</p>
        {qrCode && <img className="receipt-qr" src={qrCode} alt="Cofounder 首页二维码" />}
        <p className="receipt-date">ISSUED {result.date}</p>
        <p className="receipt-version">
            Q {result.versions.questionSet} · R {result.versions.rules} · C {result.versions.content}
        </p>
        <div className="receipt-barcode" aria-hidden="true" />
    </>
);

const ReceiptPrinterOverlay: React.FC<ReceiptPrinterOverlayProps> = ({
    result,
    publicPath,
    onClose,
}) => {
    const [stage, setStage] = useState<ReceiptPrinterStage>('processing');
    const [qrCode, setQrCode] = useState('');
    const [snapshot, setSnapshot] = useState('');
    const [status, setStatus] = useState('');
    const captureRef = useRef<HTMLDivElement>(null);
    const coarsePointer = useRef(isCoarsePointer());
    const slug = publicPath.match(/^\/r\/([^/]+)$/)?.[1] || '';

    const recordShare = (action: string) => {
        if (!slug) return;
        void fetch(`/api/public-results/${encodeURIComponent(slug)}/share`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action }),
        }).catch(() => undefined);
    };

    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
            setStage('complete');
            return;
        }
        const printTimer = window.setTimeout(() => setStage('printing'), 1600);
        const completeTimer = window.setTimeout(() => setStage('complete'), 3600);
        return () => {
            window.clearTimeout(printTimer);
            window.clearTimeout(completeTimer);
        };
    }, []);

    useEffect(() => {
        QRCode.toDataURL(`${window.location.origin}${HOME_URL}`, { margin: 1, width: 180 })
            .then(setQrCode)
            .catch(() => setStatus('二维码生成失败。'));
    }, []);

    useEffect(() => {
        if (stage !== 'complete' || !coarsePointer.current || !captureRef.current) return;
        toPng(captureRef.current, { cacheBust: true, pixelRatio: 2 })
            .then(setSnapshot)
            .catch(() => undefined);
    }, [stage]);

    const saveReceipt = async () => {
        if (coarsePointer.current) {
            setStatus(
                snapshot
                    ? '长按小票图片，即可保存到相册。'
                    : '图片还在生成中，请稍后长按小票保存。',
            );
            return;
        }
        if (!captureRef.current) return;
        try {
            const dataUrl = await toPng(captureRef.current, {
                cacheBust: true,
                pixelRatio: 2,
            });
            downloadUrl(dataUrl, 'cofounder-identity-receipt.png');
            setStatus('Receipt PNG 已保存。');
            recordShare('receipt_download');
        } catch {
            setStatus('图片生成失败，请稍后重试。');
        }
    };

    return (
        <div className="receipt-overlay" role="dialog" aria-modal="true" aria-label="Cofounder Identity Receipt">
            {onClose && (
                <button className="receipt-close" type="button" onClick={onClose} aria-label="关闭 Receipt">
                    <X size={18} weight="bold" />
                </button>
            )}
            <ReceiptPrinter.Root stage={stage}>
                <ReceiptPrinter.Machine>
                    <ReceiptPrinter.Header>
                        <span className="receipt-logo receipt-logo-header" aria-hidden="true" />
                        <button className="tactile-button" type="button" onClick={saveReceipt}>
                            <span className="tactile-button-base" aria-hidden="true" />
                            <span className="tactile-button-face">
                                <ShareNetwork aria-hidden="true" size={13} weight="fill" />
                                Share
                            </span>
                        </button>
                    </ReceiptPrinter.Header>
                    <ReceiptPrinter.Screen>
                        <div className="receipt-screen-summary">
                            <span>{result.archetype.englishTitle}</span>
                            <b>{result.names.creator} × {result.names.partner}</b>
                        </div>
                        <ReceiptPrinter.Status>
                            {stage === 'processing'
                                ? '正在整理公开内容'
                                : stage === 'printing'
                                  ? '正在打印 Identity Receipt'
                                  : 'Identity Receipt 已生成'}
                        </ReceiptPrinter.Status>
                    </ReceiptPrinter.Screen>
                </ReceiptPrinter.Machine>
                <ReceiptPrinter.Output>
                    <div ref={captureRef}>
                        {snapshot ? (
                            <img
                                className="receipt-snapshot"
                                src={snapshot}
                                alt="Cofounder Identity Receipt"
                                draggable={false}
                            />
                        ) : (
                            <ReceiptPrinter.Paper aria-label="Cofounder Identity Receipt">
                                <ReceiptContent result={result} qrCode={qrCode} />
                            </ReceiptPrinter.Paper>
                        )}
                    </div>
                </ReceiptPrinter.Output>
            </ReceiptPrinter.Root>
            {status && <p className="receipt-action-status" role="status">{status}</p>}
        </div>
    );
};

export default ReceiptPrinterOverlay;
