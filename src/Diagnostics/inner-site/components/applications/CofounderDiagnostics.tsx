import React, { FormEvent, useEffect, useState } from 'react';
import Window from '../os/Window';

export interface CofounderDiagnosticsProps extends WindowAppProps {}

export interface AccountLoginProps {
    onComplete(): void;
}

type Stage =
    | 'loading'
    | 'privacy'
    | 'email'
    | 'otp'
    | 'profile'
    | 'renewal'
    | 'ready';

type AccountResponse = {
    signedIn: boolean;
    displayName?: string;
    consentState?: 'missing' | 'renewal_required' | 'current';
};

const ERROR_MESSAGES: Record<string, string> = {
    INVALID_OTP: '验证码不正确，请检查后重试。',
    OTP_EXPIRED: '验证码已过期，请重新发送。',
    OTP_RESEND_DELAY: '请等待 60 秒后重新发送验证码。',
    OTP_DELIVERY_FAILED: '验证码暂时无法发送，请稍后重试或更换邮箱。',
    TOO_MANY_REQUESTS: '尝试次数过多，请稍后再试。',
    DISPLAY_NAME_LENGTH: '显示名去除首尾空格后须为 1–32 个字符。',
    DISPLAY_NAME_CONTROL_CHARACTER: '显示名不能包含控制或隐藏格式字符。',
    ACKNOWLEDGEMENTS_REQUIRED: '请确认全部三项后继续。',
};

const request = async <T,>(path: string, body?: unknown): Promise<T> => {
    const response = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'include',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as T & {
        code?: string;
        message?: string;
    };

    if (!response.ok) {
        throw new Error(
            data.message ||
                (data.code && ERROR_MESSAGES[data.code]) ||
                '系统暂时无法完成请求，请稍后重试。',
        );
    }

    return data;
};

type ConsentChecklistProps = {
    ageEligible: boolean;
    termsPrivacy: boolean;
    overseasClassifier: boolean;
    renewal?: boolean;
    onAgeEligible(value: boolean): void;
    onTermsPrivacy(value: boolean): void;
    onOverseasClassifier(value: boolean): void;
};

const ConsentChecklist: React.FC<ConsentChecklistProps> = ({
    ageEligible,
    termsPrivacy,
    overseasClassifier,
    renewal = false,
    onAgeEligible,
    onTermsPrivacy,
    onOverseasClassifier,
}) => (
    <fieldset>
        <legend>{renewal ? '隐私版本已更新' : '开始前确认'}</legend>
        {renewal && (
            <p>登录和数据权利操作仍可使用。继续创建 Pair 或答题前，请确认当前版本。</p>
        )}
        <label>
            <input
                type="checkbox"
                checked={ageEligible}
                onChange={(event) => onAgeEligible(event.target.checked)}
            />
            <span>{renewal ? '我仍符合 14+ 参与条件。' : '我已满 14 周岁。'}</span>
        </label>
        <label>
            <input
                type="checkbox"
                checked={termsPrivacy}
                onChange={(event) => onTermsPrivacy(event.target.checked)}
            />
            <span>{renewal ? '我同意当前条款与隐私说明。' : '我已阅读并同意条款与隐私说明。'}</span>
        </label>
        <label>
            <input
                type="checkbox"
                checked={overseasClassifier}
                onChange={(event) => onOverseasClassifier(event.target.checked)}
            />
            <span>
                {renewal
                    ? '我单独同意当前境外自动分类处理说明。'
                    : '我单独同意去标识化特征交由境外自动分类服务处理。'}
            </span>
        </label>
    </fieldset>
);

export const AccountLogin: React.FC<AccountLoginProps> = ({ onComplete }) => {
    const [stage, setStage] = useState<Stage>('loading');
    const [ageEligible, setAgeEligible] = useState(false);
    const [termsPrivacy, setTermsPrivacy] = useState(false);
    const [overseasClassifier, setOverseasClassifier] = useState(false);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [resendSeconds, setResendSeconds] = useState(0);
    const [verifiedAccount, setVerifiedAccount] = useState(false);
    const loadAccount = async (continueVerifiedRegistration = false) => {
        const account = await request<AccountResponse>('/api/account');
        if (!account.signedIn) {
            setStage('privacy');
            return;
        }

        setVerifiedAccount(true);
        if (account.consentState === 'current') {
            onComplete();
        } else if (account.consentState === 'renewal_required') {
            setStage('renewal');
        } else {
            setStage(continueVerifiedRegistration ? 'profile' : 'privacy');
        }
    };

    useEffect(() => {
        loadAccount().catch(() => {
            setError('账户服务暂时不可用，请刷新后重试。');
            setStage('privacy');
        });
    }, []);

    useEffect(() => {
        if (resendSeconds <= 0) return;
        const timer = window.setInterval(
            () => setResendSeconds((seconds) => Math.max(0, seconds - 1)),
            1000,
        );
        return () => window.clearInterval(timer);
    }, [resendSeconds]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError('');
        try {
            await action();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '请求失败，请重试。');
        } finally {
            setBusy(false);
        }
    };

    const sendOtp = (event: FormEvent) => {
        event.preventDefault();
        run(async () => {
            await request('/api/auth/email-otp/send-verification-otp', {
                email: email.trim(),
                type: 'sign-in',
            });
            setResendSeconds(60);
            setStage('otp');
        });
    };

    const verifyOtp = (event: FormEvent) => {
        event.preventDefault();
        run(async () => {
            await request('/api/auth/sign-in/email-otp', {
                email: email.trim(),
                otp: otp.trim(),
                name: 'Cofounder Account',
            });
            await loadAccount(true);
        });
    };

    const completeProfile = (event: FormEvent) => {
        event.preventDefault();
        run(async () => {
            const result = await request<{
                displayName: string;
                consentState: 'current';
            }>('/api/account/registration', {
                displayName,
                ageEligible,
                termsPrivacy,
                overseasClassifier,
            });
            setDisplayName(result.displayName);
            onComplete();
        });
    };

    const renewConsent = (event: FormEvent) => {
        event.preventDefault();
        run(async () => {
            await request('/api/account/consent', {
                ageEligible,
                termsPrivacy,
                overseasClassifier,
            });
            await loadAccount();
        });
    };

    const allAcknowledged = ageEligible && termsPrivacy && overseasClassifier;

    return (
        <main className="account-login-screen">
            <section className="account-login-dialog" aria-label="Cofounder 系统登录">
                <div className="account-login-titlebar">
                    <span>Log On to Cofounder</span>
                </div>
                <div className="account-panel">
                    <header className="account-header account-login-header">
                        <div className="account-login-icon" aria-hidden="true">C</div>
                        <div className="account-login-copy">
                            <h1>欢迎使用 Cofounder</h1>
                            <p>请完成账户验证，然后进入桌面。</p>
                        </div>
                    </header>

                    {stage === 'loading' && <p role="status">正在检查账户状态……</p>}

                        {stage === 'privacy' && (
                            <form
                                className="account-form"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    setError('');
                                    setStage(verifiedAccount ? 'profile' : 'email');
                                }}
                            >
                                <ConsentChecklist
                                    ageEligible={ageEligible}
                                    termsPrivacy={termsPrivacy}
                                    overseasClassifier={overseasClassifier}
                                    onAgeEligible={setAgeEligible}
                                    onTermsPrivacy={setTermsPrivacy}
                                    onOverseasClassifier={setOverseasClassifier}
                                />
                                <details className="privacy-summary">
                                    <summary>查看简明条款与隐私说明</summary>
                                    <p>
                                        Cofounder 是娱乐产品，不是科学、心理、法律或投资评估。账户邮箱仅用于登录和必要通知。
                                        双方答案会形成共同报告；敏感主题不归因到个人，完成后会删除原始敏感选项。
                                        去标识化 Pair 特征可交由境外 TypeSafe AI 分类，分类器不接收姓名、邮箱或原始答案。
                                        你可以在 Privacy &amp; Data 中导出数据、退出 Pair 或删除账户。
                                    </p>
                                </details>
                                <p className="account-note">
                                    双方答案会合并为共同解读；敏感主题只报告“存在差异”，不会归因到个人。
                                </p>
                                <button type="submit" disabled={!allAcknowledged}>
                                    下一步：验证邮箱
                                </button>
                            </form>
                        )}

                        {stage === 'email' && (
                            <form className="account-form" onSubmit={sendOtp}>
                                <label className="field-label" htmlFor="account-email">
                                    EMAIL ID
                                </label>
                                <input
                                    id="account-email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                />
                                <p className="account-note">
                                    我们会发送一个 10 分钟有效的 6 位验证码。
                                </p>
                                <div className="form-actions">
                                    <button type="button" onClick={() => setStage('privacy')}>
                                        返回
                                    </button>
                                    <button type="submit" disabled={busy}>发送验证码</button>
                                </div>
                            </form>
                        )}

                        {stage === 'otp' && (
                            <form className="account-form" onSubmit={verifyOtp}>
                                <label className="field-label" htmlFor="account-otp">
                                    VERIFICATION CODE
                                </label>
                                <input
                                    id="account-otp"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    required
                                    value={otp}
                                    onChange={(event) => setOtp(event.target.value)}
                                />
                                <p className="account-note">验证码已发送到 {email}</p>
                                <div className="form-actions">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOtp('');
                                            setStage('email');
                                        }}
                                    >
                                        更换邮箱
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busy || resendSeconds > 0}
                                        onClick={() =>
                                            sendOtp({ preventDefault: () => undefined } as FormEvent)
                                        }
                                    >
                                        {resendSeconds > 0
                                            ? `${resendSeconds}s 后重发`
                                            : '重新发送'}
                                    </button>
                                    <button type="submit" disabled={busy}>验证并登录</button>
                                </div>
                            </form>
                        )}

                        {stage === 'profile' && (
                            <form className="account-form" onSubmit={completeProfile}>
                                <label className="field-label" htmlFor="display-name">
                                    ACCOUNT DISPLAY NAME
                                </label>
                                <input
                                    id="display-name"
                                    autoComplete="nickname"
                                    maxLength={64}
                                    required
                                    value={displayName}
                                    onChange={(event) => setDisplayName(event.target.value)}
                                />
                                <p className="account-note">
                                    1–32 个字符。可使用真名、昵称或角色名；不会从邮箱自动生成。
                                </p>
                                <button type="submit" disabled={busy}>创建 Account</button>
                            </form>
                        )}

                        {stage === 'renewal' && (
                            <form className="account-form" onSubmit={renewConsent}>
                                <ConsentChecklist
                                    renewal
                                    ageEligible={ageEligible}
                                    termsPrivacy={termsPrivacy}
                                    overseasClassifier={overseasClassifier}
                                    onAgeEligible={setAgeEligible}
                                    onTermsPrivacy={setTermsPrivacy}
                                    onOverseasClassifier={setOverseasClassifier}
                                />
                                <button type="submit" disabled={busy || !allAcknowledged}>
                                    确认并继续
                                </button>
                            </form>
                        )}

                    {error && <p className="account-error" role="alert">{error}</p>}
                </div>
            </section>
        </main>
    );
};

const CofounderDiagnostics: React.FC<CofounderDiagnosticsProps> = (props) => {
    const compact = window.innerWidth < 640;

    return (
        <Window
            top={compact ? 8 : 24}
            left={compact ? 8 : 104}
            width={Math.max(320, window.innerWidth - (compact ? 16 : 160))}
            height={Math.max(420, window.innerHeight - (compact ? 48 : 100))}
            windowTitle="Cofounder Diagnostics - Showcase 2026"
            windowBarIcon="windowExplorerIcon"
            closeWindow={props.onClose}
            onInteract={props.onInteract}
            minimizeWindow={props.onMinimize}
            bottomLeftText="SYSTEM READY"
        >
            <div className="diagnostics-browser">
                <div className="browser-menu" aria-label="Browser menu">
                    <span><u>F</u>ile</span>
                    <span><u>E</u>dit</span>
                    <span><u>V</u>iew</span>
                    <span>F<u>a</u>vorites</span>
                    <span><u>H</u>elp</span>
                </div>
                <div className="address-bar">
                    <span>Address</span>
                    <div>cofounder.local/desktop</div>
                    <strong>Go</strong>
                </div>
                <main className="diagnostics-content">
                    <h1>你们放在一起，会形成一家什么样的公司？</h1>
                    <p className="diagnostics-description">
                        双人合伙关系压力测试。Account 已登录，下一步将从这里创建 Pair Test。
                    </p>
                    <div className="diagnostics-status">
                        <div><b>MODE</b><span>2 PARTICIPANTS</span></div>
                        <div><b>DURATION</b><span>ABOUT 10 MIN</span></div>
                        <div><b>ACCOUNT</b><span>VERIFIED</span></div>
                    </div>
                    <div className="diagnostics-actions">
                        <button type="button" disabled>NEW PAIR TEST — ISSUE #4</button>
                    </div>
                    <p className="diagnostics-disclaimer">
                        娱乐测试，不构成心理、投资、法律或专业建议。
                    </p>
                </main>
            </div>
        </Window>
    );
};

export default CofounderDiagnostics;
