import { renderEmailLayout } from './email-layout';

export type PairEmailType = 'expiry_reminder' | 'report_ready';

export type PairEmail = {
    subject: string;
    html: string;
    text: string;
};

const escapeHtml = (value: string) =>
    value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character]!,
    );

export const renderPairEmail = (
    type: PairEmailType,
    expiresAt?: string,
): PairEmail => {
    const isReminder = type === 'expiry_reminder';
    const expiryDate = expiresAt?.slice(0, 10) || '';
    if (isReminder && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        throw new Error('Expiry reminder requires a valid date');
    }
    const title = isReminder ? '你们的 Pair 即将到期' : '你们的报告已准备好';
    const copy = isReminder
        ? `这份尚未完成的 Cofounder Pair 将于 ${expiryDate} 到期。继续回答即可延长保留时间。`
        : '双方都已完成测试。登录 Cofounder 查看共同报告。';
    const safeTitle = escapeHtml(title);
    const safeCopy = escapeHtml(copy);

    return {
        subject: isReminder
            ? 'Cofounder Pair 将在 7 天后到期'
            : 'Cofounder 报告已准备好',
        text: `${title}\n\n${copy}\n\n这封邮件不包含问卷答案或报告内容。`,
        html: renderEmailLayout({
            title: safeTitle,
            preheader: safeCopy,
            bodyHtml: `<h1 style="margin:0;color:#ffffff;font-family:'Arial Narrow',Arial,sans-serif;font-size:42px;line-height:1;letter-spacing:-1px;">${safeTitle}</h1><p style="margin:24px 0 0;color:#c4c4c4;font-size:15px;line-height:1.7;">${safeCopy}</p>`,
            footerHtml:
                'Cofounder · AI 时代合伙人压力测试<br>这封邮件不包含问卷答案或报告内容。',
        }),
    };
};
