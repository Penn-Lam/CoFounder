import React, { FormEvent, useEffect, useState } from 'react';
import Window from '../os/Window';

export interface PrivacyDataProps extends WindowAppProps {}

type PrivacyExport = {
    exportedAt: string;
    account: { displayName: string; email: string };
    consents: Array<{ type: string; version: string; consentedAt: string }>;
    ownPairData: Array<{
        pairId: string;
        role: 'creator' | 'partner';
        lifecycle: string;
        answers: Record<string, string>;
        submittedAt: string | null;
    }>;
    sharedReports: Array<{ pairId: string }>;
};

type PendingAction =
    | { type: 'pair'; pairId: string }
    | { type: 'account' };

const jsonRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(path, {
        credentials: 'include',
        ...init,
        headers: init?.body ? { 'content-type': 'application/json' } : init?.headers,
    });
    const data = (await response.json().catch(() => ({}))) as T & {
        code?: string;
        message?: string;
    };
    if (!response.ok) {
        throw new Error(data.message || data.code || '请求失败，请稍后重试。');
    }
    return data;
};

const PrivacyData: React.FC<PrivacyDataProps> = (props) => {
    const [data, setData] = useState<PrivacyExport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pending, setPending] = useState<PendingAction | null>(null);
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setData(await jsonRequest<PrivacyExport>('/api/privacy/export'));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '无法载入数据。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const downloadExport = async () => {
        setBusy(true);
        setError('');
        try {
            const response = await fetch('/api/privacy/export', { credentials: 'include' });
            if (!response.ok) throw new Error('导出失败，请稍后重试。');
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = `cofounder-data-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '导出失败。');
        } finally {
            setBusy(false);
        }
    };

    const beginAction = async (action: PendingAction) => {
        setBusy(true);
        setError('');
        setPending(action);
        setOtp('');
        setAuthorized(false);
        try {
            await jsonRequest('/api/privacy/challenge', { method: 'POST' });
            setOtpSent(true);
        } catch (caught) {
            setPending(null);
            setError(caught instanceof Error ? caught.message : '验证码发送失败。');
        } finally {
            setBusy(false);
        }
    };

    const verify = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            await jsonRequest('/api/privacy/authorize', {
                method: 'POST',
                body: JSON.stringify({ otp }),
            });
            setAuthorized(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '验证码无效。');
        } finally {
            setBusy(false);
        }
    };

    const confirmAction = async () => {
        if (!pending || !authorized) return;
        setBusy(true);
        setError('');
        try {
            const path =
                pending.type === 'account'
                    ? '/api/privacy/account'
                    : `/api/privacy/pairs/${encodeURIComponent(pending.pairId)}`;
            await jsonRequest(path, { method: 'DELETE' });
            if (pending.type === 'account') {
                window.location.assign('/desktop');
                return;
            }
            setPending(null);
            setOtpSent(false);
            setAuthorized(false);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '删除操作失败。');
        } finally {
            setBusy(false);
        }
    };

    const compact = window.innerWidth < 640;
    return (
        <Window
            top={compact ? 8 : 44}
            left={compact ? 8 : 140}
            width={Math.max(320, Math.min(850, window.innerWidth - (compact ? 16 : 220)))}
            height={Math.max(420, window.innerHeight - (compact ? 48 : 120))}
            windowTitle="Privacy & Data"
            windowBarIcon="computerBig"
            closeWindow={props.onClose}
            onInteract={props.onInteract}
            minimizeWindow={props.onMinimize}
        >
            <main className="privacy-data">
                <header>
                    <h1>Privacy &amp; Data</h1>
                    <p>查看 Cofounder 保留了什么，并直接导出或删除。</p>
                </header>

                {loading && <p role="status">正在读取账户数据…</p>}
                {error && <div className="pair-save-error" role="alert">{error}</div>}

                {data && (
                    <>
                        <section>
                            <h2>Account</h2>
                            <p><b>{data.account.displayName}</b> · {data.account.email}</p>
                            <p>
                                Account 保存登录身份、显示名和版本化同意记录。登录、导出和删除在同意版本过期时仍然可用。
                            </p>
                            <button type="button" onClick={downloadExport} disabled={busy}>
                                导出我的 JSON 数据
                            </button>
                        </section>

                        <section>
                            <h2>Pair 与报告</h2>
                            <p>
                                每位参与者独立提供答案。导出只包含你自己的保留答案，以及双方共同可见的共享报告；不会包含对方的私人逐题答案。
                            </p>
                            <div className="privacy-pair-list">
                                {data.ownPairData.length === 0 ? (
                                    <p>当前没有保留的 Pair 数据。</p>
                                ) : (
                                    data.ownPairData.map((pair) => (
                                        <article key={pair.pairId}>
                                            <div>
                                                <b>Pair {pair.pairId.slice(0, 8)}</b>
                                                <span>{pair.role === 'creator' ? '发起人' : 'Cofounder'}</span>
                                                <span>{Object.keys(pair.answers).length} 条自己的答案</span>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => beginAction({ type: 'pair', pairId: pair.pairId })}
                                            >
                                                撤回并删除我的 Pair 数据
                                            </button>
                                        </article>
                                    ))
                                )}
                            </div>
                        </section>

                        <section>
                            <h2>Jev 与境外处理</h2>
                            <p>
                                只有在你单独同意后，去标识化的 Pair Feature Vector 才会交给境外 Jev 服务做受限分类。
                                Jev 不接收姓名、邮箱、逐题原始答案或敏感题选项，也不负责撰写最终文案。
                            </p>
                        </section>

                        <section>
                            <h2>Sensitive Topic 删除</h2>
                            <p>
                                报告生成后，股权、Commitment、Ethics、CEO Removal 等敏感题原始选项会从在线答案中删除。
                                导出不会从报告或特征中反推、重建这些已删除选项。
                            </p>
                        </section>

                        <section>
                            <h2>删除、备份与已下载文件</h2>
                            <p>
                                在线删除会立即让已撤回的报告和公开链接失效，并留下不识别 Pair 的 Withdrawn Result 页面。
                                基础设施备份中的副本按服务商保留窗口自然过期，无法承诺逐份即时物理擦除，也不会再用于在线产品。
                                已经下载或被他人保存的 Receipt 图片和 QR 无法远程收回。
                            </p>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => beginAction({ type: 'account' })}
                            >
                                删除 Account 和我的全部 Pair 数据
                            </button>
                        </section>
                    </>
                )}

                {pending && otpSent && (
                    <section className="privacy-confirmation" aria-live="polite">
                        <h2>{pending.type === 'account' ? '确认删除 Account' : '确认撤回 Pair 数据'}</h2>
                        {!authorized ? (
                            <form onSubmit={verify}>
                                <p>我们已向你的登录邮箱发送 6 位验证码。验证后，此授权只能使用一次。</p>
                                <label htmlFor="privacy-otp">验证码</label>
                                <input
                                    id="privacy-otp"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                                />
                                <button
                                    type="submit"
                                    className="button-primary"
                                    disabled={busy || otp.length !== 6}
                                >
                                    验证
                                </button>
                            </form>
                        ) : (
                            <div>
                                <p>
                                    {pending.type === 'account'
                                        ? '这会退出所有 Pair、删除你的在线答案并让当前登录失效。对方独立提供的数据会保留。'
                                        : '这会删除你在该 Pair 的答案，并立即让共享报告与公开结果失效。对方自己的答案会保留。'}
                                </p>
                                <div className="public-result-actions">
                                    <button type="button" onClick={() => setPending(null)}>取消</button>
                                    <button className="danger-button button-primary" type="button" disabled={busy} onClick={confirmAction}>
                                        确认执行不可撤销操作
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </main>
        </Window>
    );
};

export default PrivacyData;
