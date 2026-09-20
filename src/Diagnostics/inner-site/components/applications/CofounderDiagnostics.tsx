import React, { FormEvent, useEffect, useRef, useState } from 'react';
import Window from '../os/Window';
import ContentReview from './ContentReview';
import {
    PRINT_RECEIPT_EVENT,
    PrintReceiptDetail,
} from '../receipt/ReceiptPrinterOverlay';

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
    ACTIVE_PAIR_LIMIT: '最多只能同时保留 3 个未完成的 Pair。请继续已有测试。',
    REVISION_CONFLICT: '另一台设备已经保存了更新版本。请重新载入后继续。',
    PAIR_TEST_SEALED: '这份 Pair Test 已提交，不能再修改。',
    QUESTION_SET_NOT_FOUND: '这份 Pair Test 使用的题库版本暂时不可用。',
    INVITATION_NOT_FOUND: '邀请链接无效、已取消或已经被使用。',
    INVITATION_ACCEPTANCE_REQUIRED: '请明确接受邀请后继续。',
    SELF_INVITATION: '不能使用创建 Pair 的同一个账户接受邀请。',
    INVITATION_LOCKED: '合伙人已经加入，不能再重置或取消邀请。',
    DISPLAY_NAME_REQUIRED: '请先设置显示名，再接受邀请。',
};

const request = async <T,>(
    path: string,
    body?: unknown,
    method?: 'POST' | 'PUT' | 'DELETE',
): Promise<T> => {
    const response = await fetch(path, {
        method: method || (body === undefined ? 'GET' : 'POST'),
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

type Option = { id: string; text: string };
type Question = {
    id: string;
    dimension?: string;
    topic?: string;
    prompt: string;
    options: Option[];
};
type Questionnaire = {
    questionSetVersion: string;
    profile: {
        relationship_stages: string[];
        durations: string[];
        responsibilities: string[];
        company_authority: string[];
    };
    questions: Question[];
    mirrorQuestionIds: string[];
    redLineQuestions: Question[];
};
type PairProfile = {
    relationshipStages: string[];
    knownDuration: string;
    workedDuration: string;
    responsibilities: string[];
    companyAuthority: string;
};
type PairState = {
    pairId: string;
    role: 'creator' | 'partner';
    lifecycle:
        | 'creator_draft'
        | 'waiting_partner'
        | 'partner_in_progress'
        | 'pair_complete'
        | 'report_generating'
        | 'report_ready';
    reportStatus: 'pending' | 'generating' | 'ready';
    notificationReady: boolean;
    partnerStatus: 'not_started' | 'started' | null;
    invitationStatus: 'unavailable' | 'active' | 'cancelled' | 'claimed';
    questionSetVersion: string;
    revision: number;
    status: 'draft' | 'submitted';
    profile: PairProfile | null;
    answers: Record<string, string>;
    invitation?: { path: string };
};
type InvitationPreview = { creatorDisplayName: string };
type TestQuestion = Question & {
    section: 'core' | 'mirror' | 'red-line';
    answerKey: string;
};
type PrivateReport = {
    portrait: { title: string; englishTitle: string; copy: string };
    alignment: { dimension: string; title: string; copy: string };
    complement: { dimension: string; title: string; copy: string };
    sections: Record<
        'topDifference' | 'dimensions' | 'mirror' | 'flags' | 'prompts',
        { title: string; copy: string }
    >;
    topRisk: { title: string; copy: string };
    privatePattern: { title: string; copy: string; action: string };
    dimensions: Array<{
        dimension: string;
        label: string;
        bandContent: {
            a: { label: string; copy: string };
            b: { label: string; copy: string };
        };
        match: number;
        relationLabel: string;
    }>;
    mirror: {
        aPredictsB: { exact: number; near: number; opposite: number };
        bPredictsA: { exact: number; near: number; opposite: number };
    };
    conflictFlags: Array<{
        id: string;
        title: string;
        copy: string;
        severityLabel: string;
        dimensionLabel: string;
    }>;
    sensitiveContext: {
        signals: Array<{
            topic: string;
            topicLabel: string;
            stateLabel: string;
            severityLabel: string | null;
        }>;
    };
    prompts: Array<{ id: string; copy: string }>;
    disclaimer: { copy: string };
};
type ReportResponse = {
    status: 'pending' | 'generating' | 'ready';
    notificationReady: boolean;
    report?: PrivateReport;
};
type PublicResultState = {
    published: boolean;
    myNamePublic: boolean;
};

const PROFILE_LABELS: Record<string, string> = {
    'equity-discussed': '已经聊到股权',
    'side-project': '一起做 Side Project',
    'company-registered': '公司已注册',
    users: '已经有用户',
    revenue: '已经有收入',
    funded: '已融资',
    'survived-crisis': '一起经历过“大事不妙”',
    'under-3m': '少于 3 个月',
    '3-12m': '3–12 个月',
    '1-3y': '1–3 年',
    '3-5y': '3–5 年',
    'over-5y': '5 年以上',
    product: '产品',
    frontend: '前端',
    backend: '后端',
    'ai-models': 'AI / 模型',
    research: 'Research',
    design: 'Design',
    sales: 'Sales',
    bd: 'BD',
    'customer-delivery': '客户交付',
    'marketing-pr': '市场 / PR',
    fundraising: '融资',
    hiring: '招聘',
    finance: '财务',
    'company-management': '公司管理',
    strategy: '战略',
    other: '其他',
    self: '我拥有最终决定权',
    partner: '合伙人拥有最终决定权',
    shared: '共同决定',
    undefined: '还没有说清楚',
};

const emptyProfile: PairProfile = {
    relationshipStages: [],
    knownDuration: '',
    workedDuration: '',
    responsibilities: [],
    companyAuthority: '',
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
    const [otpExpiresSeconds, setOtpExpiresSeconds] = useState(0);
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

    useEffect(() => {
        if (otpExpiresSeconds <= 0) return;
        const timer = window.setInterval(
            () => setOtpExpiresSeconds((seconds) => Math.max(0, seconds - 1)),
            1000,
        );
        return () => window.clearInterval(timer);
    }, [otpExpiresSeconds]);

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
            setOtpExpiresSeconds(10 * 60);
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
                                    6 位验证码
                                </label>
                                <input
                                    id="account-otp"
                                    className="account-otp-input"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    required
                                    value={otp}
                                    onChange={(event) => setOtp(event.target.value)}
                                />
                                <p className="account-note">验证码已发送到 {email}</p>
                                <p
                                    className={
                                        otpExpiresSeconds > 0
                                            ? 'otp-countdown'
                                            : 'otp-countdown expired'
                                    }
                                    role="status"
                                >
                                    {otpExpiresSeconds > 0
                                        ? `有效期 ${String(Math.floor(otpExpiresSeconds / 60)).padStart(2, '0')}:${String(otpExpiresSeconds % 60).padStart(2, '0')}`
                                        : '验证码已过期，请重新发送。'}
                                </p>
                                <div className="form-actions">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOtp('');
                                            setOtpExpiresSeconds(0);
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
                                    <button
                                        type="submit"
                                        disabled={busy || otpExpiresSeconds <= 0}
                                    >
                                        验证并登录
                                    </button>
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

const toggleValue = (values: string[], value: string) =>
    values.includes(value)
        ? values.filter((current) => current !== value)
        : [...values, value];

const PairTestFlow: React.FC<{
    initialPair: PairState;
    questionnaire: Questionnaire;
    onExit(): void;
}> = ({ initialPair, questionnaire, onExit }) => {
    const [pair, setPair] = useState(initialPair);
    const [profile, setProfile] = useState(initialPair.profile || emptyProfile);
    const [questionIndex, setQuestionIndex] = useState(
        initialPair.profile ? 0 : -1,
    );
    const [choice, setChoice] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [review, setReview] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [invitationPath, setInvitationPath] = useState(
        initialPair.invitation?.path || '',
    );
    const [copyStatus, setCopyStatus] = useState('');
    const [report, setReport] = useState<PrivateReport | null>(null);
    const [publicState, setPublicState] = useState<PublicResultState | null>(null);
    const [showPublishControls, setShowPublishControls] = useState(false);
    const [showMyName, setShowMyName] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);

    const questions: TestQuestion[] = [
        ...questionnaire.questions.map((question) => ({
            ...question,
            section: 'core' as const,
            answerKey: `core:${question.id}`,
        })),
        ...questionnaire.mirrorQuestionIds.map((id) => {
            const source = questionnaire.questions.find((question) => question.id === id)!;
            return {
                ...source,
                prompt: `你觉得 TA 会怎么选？\n${source.prompt}`,
                section: 'mirror' as const,
                answerKey: `mirror:${source.id}`,
            };
        }),
        ...questionnaire.redLineQuestions.map((question) => ({
            ...question,
            section: 'red-line' as const,
            answerKey: `red-line:${question.id}`,
        })),
    ];
    const current = questions[questionIndex];

    useEffect(() => {
        setChoice(current ? pair.answers[current.answerKey] || '' : '');
    }, [questionIndex, pair.answers]);

    useEffect(() => {
        document.querySelector('.diagnostics-content')?.scrollTo(0, 0);
        headingRef.current?.focus();
    }, [questionIndex, review]);

    useEffect(() => {
        if (pair.reportStatus === 'pending' || pair.status !== 'submitted') return;
        let active = true;
        const poll = async () => {
            try {
                const response = await request<ReportResponse>(
                    `/api/pairs/${pair.pairId}/report`,
                );
                if (!active) return;
                if (response.report) setReport(response.report);
                if (response.status !== pair.reportStatus) await reload();
            } catch (caught) {
                if (active) {
                    setError(
                        caught instanceof Error ? caught.message : '报告载入失败。',
                    );
                }
            }
        };
        poll();
        if (pair.reportStatus === 'ready') {
            return () => {
                active = false;
            };
        }
        const timer = window.setInterval(poll, 3000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [pair.pairId, pair.reportStatus, pair.status]);

    useEffect(() => {
        if (pair.reportStatus !== 'ready') return;
        request<PublicResultState>(`/api/pairs/${pair.pairId}/public-result`)
            .then((state) => {
                setPublicState(state);
                setShowMyName(state.myNamePublic);
            })
            .catch(() => undefined);
    }, [pair.pairId, pair.reportStatus]);

    const publishResult = async () => {
        setBusy(true);
        setError('');
        try {
            const receipt = await request<PrintReceiptDetail>(
                `/api/pairs/${pair.pairId}/public-result`,
                { showMyName },
            );
            setPublicState({ published: true, myNamePublic: showMyName });
            setShowPublishControls(false);
            window.dispatchEvent(
                new CustomEvent<PrintReceiptDetail>(PRINT_RECEIPT_EVENT, {
                    detail: receipt,
                }),
            );
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '公开结果生成失败。');
        } finally {
            setBusy(false);
        }
    };

    const updateNamePermission = async () => {
        setBusy(true);
        setError('');
        try {
            const state = await request<{ myNamePublic: boolean }>(
                `/api/pairs/${pair.pairId}/public-name`,
                { permitted: showMyName },
                'PUT',
            );
            setPublicState((current) => ({
                published: current?.published || false,
                myNamePublic: state.myNamePublic,
            }));
            setShowPublishControls(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '姓名权限更新失败。');
        } finally {
            setBusy(false);
        }
    };

    const unpublishResult = async () => {
        setBusy(true);
        setError('');
        try {
            await request<{ published: false }>(
                `/api/pairs/${pair.pairId}/public-result`,
                undefined,
                'DELETE',
            );
            setPublicState((current) => ({
                published: false,
                myNamePublic: current?.myNamePublic || false,
            }));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '公开结果撤回失败。');
        } finally {
            setBusy(false);
        }
    };

    const saveProfile = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const saved = await request<PairState>(
                `/api/pairs/${pair.pairId}/profile`,
                { revision: pair.revision, profile },
                'PUT',
            );
            setPair(saved);
            setQuestionIndex(0);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '资料未保存，请重试。');
        } finally {
            setBusy(false);
        }
    };

    const navigate = async (target: number | 'review') => {
        if (!current || !choice) return;
        setBusy(true);
        setError('');
        try {
            let saved = pair;
            if (pair.answers[current.answerKey] !== choice) {
                saved = await request<PairState>(
                    `/api/pairs/${pair.pairId}/answers/${current.section}/${current.id}`,
                    { revision: pair.revision, optionId: choice },
                    'PUT',
                );
                setPair(saved);
            }
            if (target === 'review') setReview(true);
            else setQuestionIndex(target);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? `尚未保存：${caught.message}`
                    : '尚未保存，请检查网络后重试。',
            );
        } finally {
            setBusy(false);
        }
    };

    const reload = async () => {
        setBusy(true);
        setError('');
        try {
            const latest = await request<PairState>(`/api/pairs/${pair.pairId}/test`);
            setPair(latest);
            setProfile(latest.profile || emptyProfile);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '重新载入失败。');
        } finally {
            setBusy(false);
        }
    };

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const sealed = await request<PairState>(
                `/api/pairs/${pair.pairId}/submit`,
                { revision: pair.revision },
            );
            setPair(sealed);
            setInvitationPath(sealed.invitation?.path || '');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '提交失败，请重试。');
        } finally {
            setBusy(false);
        }
    };

    const updateInvitation = async (action: 'reset' | 'cancel') => {
        setBusy(true);
        setError('');
        setCopyStatus('');
        try {
            const updated = await request<PairState>(
                `/api/pairs/${pair.pairId}/invitation`,
                { action },
            );
            setPair(updated);
            setInvitationPath(updated.invitation?.path || '');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '邀请操作失败，请重试。');
        } finally {
            setBusy(false);
        }
    };

    const copyInvitation = async () => {
        if (!invitationPath) return;
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${invitationPath}`);
            setCopyStatus('邀请链接已复制。');
        } catch {
            setCopyStatus('复制失败，请手动复制下面的链接。');
        }
    };

    if (pair.status === 'submitted') {
        if (pair.reportStatus === 'ready' && report) {
            const ownKey = pair.role === 'creator' ? 'a' : 'b';
            const partnerKey = ownKey === 'a' ? 'b' : 'a';
            const ownMirror = ownKey === 'a'
                ? report.mirror.aPredictsB
                : report.mirror.bPredictsA;
            const partnerMirror = ownKey === 'a'
                ? report.mirror.bPredictsA
                : report.mirror.aPredictsB;
            return (
                <article className="private-report" aria-live="polite">
                    <header>
                        <p className="report-ready-notice">报告已就绪</p>
                        <h1>{report.portrait.title}</h1>
                        <p className="report-secondary">{report.portrait.englishTitle}</p>
                        <p>{report.portrait.copy}</p>
                    </header>
                    <div className="report-summary-grid">
                        <section>
                            <h2>{report.alignment.title}</h2>
                            <b>{report.dimensions.find(({ dimension }) => dimension === report.alignment.dimension)?.label}</b>
                            <p>{report.alignment.copy}</p>
                        </section>
                        <section>
                            <h2>{report.complement.title}</h2>
                            <b>{report.dimensions.find(({ dimension }) => dimension === report.complement.dimension)?.label}</b>
                            <p>{report.complement.copy}</p>
                        </section>
                        <section>
                            <h2>{report.sections.topDifference.title}</h2>
                            <b>{report.topRisk.title}</b>
                            <p>{report.topRisk.copy}</p>
                            <h3>{report.privatePattern.title}</h3>
                            <p>{report.privatePattern.copy}</p>
                            <p>{report.privatePattern.action}</p>
                        </section>
                    </div>
                    <section>
                        <h2>{report.sections.dimensions.title}</h2>
                        <p>{report.sections.dimensions.copy}</p>
                        <div className="report-dimensions">
                            {report.dimensions.map((dimension) => (
                                <article key={dimension.dimension}>
                                    <h3>{dimension.label}</h3>
                                    <p><b>我：</b>{dimension.bandContent[ownKey].label}</p>
                                    <p><b>TA：</b>{dimension.bandContent[partnerKey].label}</p>
                                    <strong>维度匹配 {dimension.match}</strong>
                                    <small>{dimension.relationLabel}</small>
                                </article>
                            ))}
                        </div>
                    </section>
                    <section>
                        <h2>{report.sections.mirror.title}</h2>
                        <p>{report.sections.mirror.copy}</p>
                        <div className="report-summary-grid">
                            <article>
                                <h3>我对 TA 的预测</h3>
                                <p>准确 {ownMirror.exact} · 接近 {ownMirror.near} · 相反 {ownMirror.opposite}</p>
                            </article>
                            <article>
                                <h3>TA 对我的预测</h3>
                                <p>准确 {partnerMirror.exact} · 接近 {partnerMirror.near} · 相反 {partnerMirror.opposite}</p>
                            </article>
                        </div>
                    </section>
                    <section>
                        <h2>{report.sections.flags.title}</h2>
                        <p>{report.sections.flags.copy}</p>
                        {report.conflictFlags.length === 0 ? (
                            <p>没有触发普通冲突信号。</p>
                        ) : (
                            <ul>
                                {report.conflictFlags.map((flag) => (
                                    <li key={flag.id}>
                                        <b>{flag.title}</b> · {flag.dimensionLabel} · {flag.severityLabel}
                                        <p>{flag.copy}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <h3>敏感话题（不归因）</h3>
                        <p>以下只保留 Pair 层面的状态，不指出任何答案属于谁。</p>
                        <ul>
                            {report.sensitiveContext.signals.map((signal) => (
                                <li key={signal.topic}>
                                    {signal.topicLabel} · {signal.stateLabel}
                                    {signal.severityLabel ? ` · ${signal.severityLabel}` : ''}
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section>
                        <h2>{report.sections.prompts.title}</h2>
                        <p>{report.sections.prompts.copy}</p>
                        <ol>
                            {report.prompts.map((prompt) => (
                                <li key={prompt.id}>{prompt.copy}</li>
                            ))}
                        </ol>
                    </section>
                    <section className="public-result-controls">
                        <h2>Identity Receipt</h2>
                        <p>
                            公开 Receipt 只包含双方授权后的姓名、公开团队类型、三项安全特征和人工文案。
                            不会包含答案、维度分、Mirror、红线或私人报告内容。
                        </p>
                        {publicState?.published && !showPublishControls ? (
                            <>
                                <p className="public-result-live">公开结果已发布</p>
                                <p>
                                    为避免保存可反查的公开 Token，系统不会恢复旧链接。
                                    重新打印会生成新链接，并让旧链接立即失效。
                                </p>
                                <div className="public-result-actions">
                                    <button type="button" disabled={busy} onClick={() => setShowPublishControls(true)}>
                                        姓名权限
                                    </button>
                                    <button type="button" disabled={busy} onClick={publishResult}>
                                        PRINT / SHARE 新链接
                                    </button>
                                    <button type="button" disabled={busy} onClick={unpublishResult}>
                                        撤回公开结果
                                    </button>
                                </div>
                            </>
                        ) : showPublishControls ? (
                            <div className="public-permission-panel">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={showMyName}
                                        onChange={(event) => setShowMyName(event.target.checked)}
                                    />
                                    <span>允许在这份 Pair 的公开 Receipt 上显示我的账户显示名</span>
                                </label>
                                <p>未勾选时，你的一侧会显示匿名角色。另一位参与者独立决定自己的姓名权限。</p>
                                <div className="public-result-actions">
                                    <button type="button" disabled={busy} onClick={() => setShowPublishControls(false)}>
                                        取消
                                    </button>
                                    {publicState?.published ? (
                                        <button type="button" disabled={busy} onClick={updateNamePermission}>
                                            保存姓名权限
                                        </button>
                                    ) : (
                                        <button type="button" disabled={busy} onClick={publishResult}>
                                            生成并打印 Receipt
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <button type="button" disabled={busy} onClick={() => setShowPublishControls(true)}>
                                PRINT / SHARE
                            </button>
                        )}
                        {error && <div className="pair-save-error" role="alert">{error}</div>}
                    </section>
                    <footer><p>{report.disclaimer.copy}</p></footer>
                    <button type="button" onClick={onExit}>返回首页</button>
                </article>
            );
        }

        if (pair.reportStatus !== 'pending' || pair.lifecycle === 'pair_complete') {
            return (
                <section className="pair-complete report-generating" aria-live="polite">
                    <h1>正在生成报告</h1>
                    <p>双方回答已封存。系统正在按固定规则组装报告，请稍后返回。</p>
                    <p>此页面会自动刷新；报告就绪后会显示通知状态。</p>
                    {error && <div className="pair-save-error" role="alert">{error}</div>}
                    <button type="button" onClick={reload} disabled={busy}>立即刷新</button>
                    <button type="button" onClick={onExit}>返回首页</button>
                </section>
            );
        }

        return (
            <section className="pair-complete" aria-live="polite">
                <h1>你的部分完成了。</h1>
                <p>已提交答案不可修改，也不会向另一位参与者展示。</p>
                {pair.role === 'creator' && pair.invitationStatus !== 'claimed' && (
                    <div className="invitation-panel">
                        <h2>邀请你的 Cofounder</h2>
                        <p>打开链接只会显示邀请说明。对方登录并明确接受后，才会加入 Pair。</p>
                        {invitationPath ? (
                            <>
                                <output>{window.location.origin}{invitationPath}</output>
                                <button type="button" onClick={copyInvitation}>复制邀请链接</button>
                            </>
                        ) : (
                            <p>
                                {pair.invitationStatus === 'active'
                                    ? '出于安全原因，刷新后不再显示原链接。你可以生成新链接，旧链接会立即失效。'
                                    : '当前没有有效邀请链接。'}
                            </p>
                        )}
                        <div className="invitation-actions">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => updateInvitation('reset')}
                            >
                                {invitationPath ? '重置邀请链接' : '生成新邀请链接'}
                            </button>
                            {pair.invitationStatus === 'active' && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => updateInvitation('cancel')}
                                >
                                    取消邀请
                                </button>
                            )}
                        </div>
                        {copyStatus && <p role="status">{copyStatus}</p>}
                    </div>
                )}
                {pair.role === 'creator' && pair.invitationStatus === 'claimed' && (
                    <div className="partner-waiting-state">
                        <strong>
                            {pair.partnerStatus === 'started'
                                ? 'TA 已经开始测试。'
                                : 'TA 尚未开始测试。'}
                        </strong>
                        <p>为避免施压，这里不会显示具体答题进度。</p>
                    </div>
                )}
                {pair.role === 'partner' && (
                    <p>你的提交已完成。双方完成后，Pair 会进入报告生成阶段。</p>
                )}
                {error && <div className="pair-save-error" role="alert">{error}</div>}
                <div className="pair-navigation">
                    <button type="button" onClick={reload} disabled={busy}>刷新 Pair 状态</button>
                    <button type="button" onClick={onExit}>返回首页</button>
                </div>
            </section>
        );
    }

    if (questionIndex === -1) {
        const complete =
            profile.relationshipStages.length > 0 &&
            profile.knownDuration &&
            profile.workedDuration &&
            profile.responsibilities.length > 0 &&
            profile.companyAuthority;
        return (
            <form className="pair-profile" onSubmit={saveProfile}>
                <h1 ref={headingRef} tabIndex={-1}>先说现实，不说 Title</h1>
                <p>这些是未计分的关系背景，会帮助后续理解你们的答案。</p>
                <fieldset>
                    <legend>你们现在是什么状态？（可多选）</legend>
                    <div className="profile-options">
                        {questionnaire.profile.relationship_stages.map((value) => (
                            <label key={value}>
                                <input
                                    type="checkbox"
                                    checked={profile.relationshipStages.includes(value)}
                                    onChange={() =>
                                        setProfile({
                                            ...profile,
                                            relationshipStages: toggleValue(
                                                profile.relationshipStages,
                                                value,
                                            ),
                                        })
                                    }
                                />
                                <span>{PROFILE_LABELS[value]}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                <div className="profile-selects">
                    <label>
                        认识多久？
                        <select
                            required
                            value={profile.knownDuration}
                            onChange={(event) =>
                                setProfile({ ...profile, knownDuration: event.target.value })
                            }
                        >
                            <option value="">请选择</option>
                            {questionnaire.profile.durations.map((value) => (
                                <option key={value} value={value}>{PROFILE_LABELS[value]}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        真正一起工作多久？
                        <select
                            required
                            value={profile.workedDuration}
                            onChange={(event) =>
                                setProfile({ ...profile, workedDuration: event.target.value })
                            }
                        >
                            <option value="">请选择</option>
                            {questionnaire.profile.durations.map((value) => (
                                <option key={value} value={value}>{PROFILE_LABELS[value]}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <fieldset>
                    <legend>你实际负责什么？（可多选）</legend>
                    <div className="profile-options compact-options">
                        {questionnaire.profile.responsibilities.map((value) => (
                            <label key={value}>
                                <input
                                    type="checkbox"
                                    checked={profile.responsibilities.includes(value)}
                                    onChange={() =>
                                        setProfile({
                                            ...profile,
                                            responsibilities: toggleValue(
                                                profile.responsibilities,
                                                value,
                                            ),
                                        })
                                    }
                                />
                                <span>{PROFILE_LABELS[value]}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                <fieldset>
                    <legend>目前公司级事项的最终决定权更接近：</legend>
                    <div className="profile-options">
                        {questionnaire.profile.company_authority.map((value) => (
                            <label key={value}>
                                <input
                                    type="radio"
                                    name="authority"
                                    checked={profile.companyAuthority === value}
                                    onChange={() =>
                                        setProfile({ ...profile, companyAuthority: value })
                                    }
                                />
                                <span>{PROFILE_LABELS[value]}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                {error && <div className="pair-save-error" role="alert">{error}</div>}
                <div className="pair-navigation">
                    <button type="button" onClick={onExit}>退出</button>
                    <button type="submit" disabled={!complete || busy}>
                        {busy ? '正在保存…' : '保存并开始 34 道测试题'}
                    </button>
                </div>
            </form>
        );
    }

    if (review) {
        return (
            <section className="pair-review">
                <h1 ref={headingRef} tabIndex={-1}>提交前检查</h1>
                <p>这是你的私人答案总览。你可以返回任意一题修改。</p>
                <button
                    type="button"
                    className="profile-review"
                    onClick={() => {
                        setQuestionIndex(-1);
                        setReview(false);
                    }}
                >
                    <b>关系资料</b>
                    <span>
                        阶段：{pair.profile?.relationshipStages.map((value) => PROFILE_LABELS[value]).join('、')}
                        {' · '}认识：{PROFILE_LABELS[pair.profile?.knownDuration || '']}
                        {' · '}共事：{PROFILE_LABELS[pair.profile?.workedDuration || '']}
                        {' · '}职责：{pair.profile?.responsibilities.map((value) => PROFILE_LABELS[value]).join('、')}
                        {' · '}决定权：{PROFILE_LABELS[pair.profile?.companyAuthority || '']}
                    </span>
                </button>
                <div className="review-list">
                    {questions.map((question, index) => {
                        const option = question.options.find(
                            ({ id }) => id === pair.answers[question.answerKey],
                        );
                        return (
                            <button
                                type="button"
                                key={question.answerKey}
                                onClick={() => {
                                    setQuestionIndex(index);
                                    setReview(false);
                                }}
                            >
                                <b>{question.section === 'mirror' ? `M-${question.id}` : question.id}</b>
                                <span>
                                    <small>{question.prompt}</small>
                                    <strong>{option?.text}</strong>
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="immutable-warning">
                    <strong>提交不可撤销</strong>
                    <p>提交后答案会被封存，不能编辑。再次测试将创建新的 Pair Test。</p>
                    <label>
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) => setConfirmed(event.target.checked)}
                        />
                        <span>我已检查答案，并理解提交后不可修改。</span>
                    </label>
                </div>
                {error && <div className="pair-save-error" role="alert">{error}</div>}
                <div className="pair-navigation">
                    <button type="button" onClick={() => setReview(false)}>返回最后一题</button>
                    <button type="button" disabled={!confirmed || busy} onClick={submit}>
                        {busy ? '正在封存…' : '确认提交 Pair Test'}
                    </button>
                </div>
            </section>
        );
    }

    const sectionStart = current.section === 'core' ? 0 : current.section === 'mirror' ? 24 : 30;
    const sectionTotal = current.section === 'core' ? 24 : current.section === 'mirror' ? 6 : 4;
    const sectionPosition = questionIndex - sectionStart + 1;
    const sectionName =
        current.section === 'core'
            ? '核心问题'
            : current.section === 'mirror'
              ? '镜像测试'
              : '红线问题';

    return (
        <section className="pair-question">
            <div className="question-progress">
                <span>{sectionName}</span>
                <span>{sectionPosition} / {sectionTotal}</span>
            </div>
            <progress value={sectionPosition} max={sectionTotal} />
            <p className="question-number">
                {current.section === 'mirror' ? `M-${current.id}` : current.id}
            </p>
            <h1 ref={headingRef} tabIndex={-1}>{current.prompt}</h1>
            <fieldset className="answer-options">
                <legend className="sr-only">选择一个答案</legend>
                {current.options.map((option) => (
                    <label key={option.id} className={choice === option.id ? 'selected' : ''}>
                        <input
                            type="radio"
                            name="answer"
                            value={option.id}
                            checked={choice === option.id}
                            onChange={() => setChoice(option.id)}
                        />
                        <b>{option.id}</b>
                        <span>{option.text}</span>
                    </label>
                ))}
            </fieldset>
            {error && (
                <div className="pair-save-error" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={reload} disabled={busy}>重新载入服务端版本</button>
                </div>
            )}
            <div className="pair-navigation">
                <button
                    type="button"
                    onClick={() => {
                        const previous = questionIndex - 1;
                        if (!choice || pair.answers[current.answerKey] === choice) {
                            setQuestionIndex(previous);
                        } else {
                            navigate(previous);
                        }
                    }}
                    disabled={busy}
                >
                    上一页
                </button>
                <button
                    type="button"
                    onClick={() =>
                        navigate(questionIndex === questions.length - 1 ? 'review' : questionIndex + 1)
                    }
                    disabled={!choice || busy}
                >
                    {busy
                        ? '正在保存…'
                        : questionIndex === questions.length - 1
                          ? '保存并检查全部答案'
                          : '保存并继续'}
                </button>
            </div>
        </section>
    );
};

const CofounderDiagnostics: React.FC<CofounderDiagnosticsProps> = (props) => {
    const compact = window.innerWidth < 640;
    const contentReviewPath = window.location.pathname === '/desktop/content-review';
    const invitationToken = window.location.pathname.match(/^\/invite\/([^/]+)$/)?.[1] || '';
    const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
    const [activePairs, setActivePairs] = useState<PairState[]>([]);
    const [currentPair, setCurrentPair] = useState<PairState | null>(null);
    const [invitationPreview, setInvitationPreview] = useState<InvitationPreview | null>(null);
    const [invitationViewerName, setInvitationViewerName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadHome = async () => {
        setLoading(true);
        setError('');
        try {
            const [loadedQuestionnaire, pairList] = await Promise.all([
                request<Questionnaire>('/api/questionnaire/current'),
                request<{ pairs: PairState[] }>('/api/pairs'),
            ]);
            setQuestionnaire(loadedQuestionnaire);
            setActivePairs(pairList.pairs);
            setCurrentPair(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '无法载入 Pair Test。');
        } finally {
            setLoading(false);
        }
    };

    const loadInvitation = async () => {
        setLoading(true);
        setError('');
        try {
            const [preview, loadedQuestionnaire, account] = await Promise.all([
                request<InvitationPreview>(
                    `/api/invitations/${encodeURIComponent(invitationToken)}`,
                ),
                request<Questionnaire>('/api/questionnaire/current'),
                request<AccountResponse>('/api/account'),
            ]);
            setInvitationPreview(preview);
            setQuestionnaire(loadedQuestionnaire);
            setInvitationViewerName(account.displayName || '当前账户');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '无法载入邀请。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (contentReviewPath) setLoading(false);
        else if (invitationToken) loadInvitation();
        else loadHome();
    }, []);

    const createPair = async () => {
        setLoading(true);
        setError('');
        try {
            const created = await request<PairState>('/api/pairs', {}, 'POST');
            setCurrentPair(created);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '无法创建 Pair。');
        } finally {
            setLoading(false);
        }
    };

    const openPair = async (pair: PairState) => {
        setLoading(true);
        setError('');
        try {
            if (questionnaire?.questionSetVersion !== pair.questionSetVersion) {
                const version = await request<Questionnaire>(
                    `/api/questionnaire/${encodeURIComponent(pair.questionSetVersion)}`,
                );
                setQuestionnaire(version);
            }
            setCurrentPair(pair);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '无法载入这份 Pair 的题库。');
        } finally {
            setLoading(false);
        }
    };

    const claimInvitation = async () => {
        setLoading(true);
        setError('');
        try {
            const claimed = await request<PairState>(
                `/api/invitations/${encodeURIComponent(invitationToken)}/claim`,
                { accepted: true },
            );
            window.history.replaceState(null, '', '/desktop');
            setInvitationPreview(null);
            setCurrentPair(claimed);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '无法接受邀请。');
        } finally {
            setLoading(false);
        }
    };

    const leaveInvitation = () => {
        window.history.replaceState(null, '', '/desktop');
        setInvitationPreview(null);
        loadHome();
    };

    const activeCreatedPairs = activePairs.filter(
        (pair) =>
            pair.role === 'creator' &&
            !['pair_complete', 'report_generating', 'report_ready'].includes(pair.lifecycle),
    ).length;
    const pairStatus = (pair: PairState) => {
        if (pair.reportStatus === 'ready') return '报告已就绪';
        if (pair.reportStatus === 'generating') return '正在生成报告';
        if (pair.lifecycle === 'pair_complete') return '报告等待处理中';
        if (pair.lifecycle === 'partner_in_progress') return 'TA 已经开始测试';
        if (pair.status === 'submitted') {
            return pair.invitationStatus === 'claimed' ? 'TA 尚未开始测试' : '等待邀请';
        }
        return `${Object.keys(pair.answers).length} / 34 已答`;
    };

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
            bottomLeftText={
                currentPair
                    ? `PAIR ${currentPair.pairId}`
                    : invitationToken
                      ? 'PAIR INVITATION'
                      : 'SYSTEM READY'
            }
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
                    <div>
                        cofounder.local/{currentPair
                            ? `desktop/pair/${currentPair.pairId}`
                            : invitationToken
                              ? `invite/${invitationToken}`
                              : 'desktop/home'}
                    </div>
                    <strong>Go</strong>
                </div>
                <main
                    className={`diagnostics-content${currentPair ? ' pair-active' : ''}`}
                >
                    {contentReviewPath ? (
                        <ContentReview />
                    ) : currentPair && questionnaire ? (
                        <PairTestFlow
                            initialPair={currentPair}
                            questionnaire={questionnaire}
                            onExit={loadHome}
                        />
                    ) : invitationToken ? (
                        <section className="invite-claim" aria-live="polite">
                            {loading && <p role="status">正在检查邀请链接……</p>}
                            {invitationPreview && (
                                <>
                                    <h1>{invitationPreview.creatorDisplayName} 已经完成测试。</h1>
                                    <p>现在轮到你。接受前不会加入 Pair，也不会看到对方的答案。</p>
                                    <div className="partner-waiting-state">
                                        <strong>你将以 {invitationViewerName} 的身份加入。</strong>
                                        <strong>双方提交前，彼此都看不到逐题答案。</strong>
                                        <p>接受后，你将独立完成同一版本的 34 道测试题。</p>
                                    </div>
                                    <div className="pair-navigation">
                                        <button type="button" onClick={leaveInvitation}>暂不接受</button>
                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={claimInvitation}
                                        >
                                            接受挑战
                                        </button>
                                    </div>
                                </>
                            )}
                            {error && <div className="pair-save-error" role="alert">{error}</div>}
                            {!loading && !invitationPreview && (
                                <button type="button" onClick={leaveInvitation}>返回 Cofounder</button>
                            )}
                        </section>
                    ) : (
                        <>
                            <h1>你们放在一起，会形成一家什么样的公司？</h1>
                            <p className="diagnostics-description">
                                34 道双人合伙关系压力测试。先完成自己的部分，再邀请你的 Cofounder。
                            </p>
                            <div className="diagnostics-status">
                                <div><b>MODE</b><span>2 PARTICIPANTS</span></div>
                                <div><b>DURATION</b><span>ABOUT 10 MIN</span></div>
                                <div><b>ACTIVE PAIRS</b><span>{activeCreatedPairs} / 3</span></div>
                            </div>
                            {activePairs.length > 0 && (
                                <section className="draft-list">
                                    <h2>你的 Pair</h2>
                                    {activePairs.map((pair) => (
                                        <button
                                            type="button"
                                            key={pair.pairId}
                                            onClick={() => openPair(pair)}
                                        >
                                            <span>Pair {pair.pairId.slice(0, 8)}</span>
                                            <b>{pairStatus(pair)}</b>
                                        </button>
                                    ))}
                                </section>
                            )}
                            {error && <div className="pair-save-error" role="alert">{error}</div>}
                            <div className="diagnostics-actions">
                                <button
                                    type="button"
                                    onClick={createPair}
                                    disabled={loading || activeCreatedPairs >= 3}
                                >
                                    {loading ? 'LOADING…' : 'NEW PAIR TEST'}
                                </button>
                            </div>
                            <p className="diagnostics-disclaimer">
                                娱乐测试，不构成科学、心理、投资、法律或专业建议，也不能替代双方直接沟通。
                            </p>
                        </>
                    )}
                </main>
            </div>
        </Window>
    );
};

export default CofounderDiagnostics;
