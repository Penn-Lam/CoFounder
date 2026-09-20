import { renderEmailLayout } from './email-layout';

export type OtpEmail = {
    subject: string;
    html: string;
    text: string;
};

export const renderOtpEmail = (otp: string): OtpEmail => {
    if (!/^\d{6}$/.test(otp)) throw new Error('Invalid OTP');

    return {
        subject: `${otp} — Cofounder 登录验证码`,
        text: `你的 Cofounder 登录验证码是 ${otp}。验证码将在 10 分钟后失效。请勿转发给任何人。`,
        html: renderEmailLayout({
            title: 'Cofounder 登录验证码',
            preheader: `你的 Cofounder 登录验证码是 ${otp}`,
            bodyHtml: `<h1 style="margin:0;color:#ffffff;font-family:'Arial Narrow',Arial,sans-serif;font-size:48px;line-height:1;letter-spacing:-1px;">验证你的邮箱</h1>
              <p style="margin:20px 0 0;color:#c4c4c4;font-size:14px;line-height:1.6;">输入下面的 6 位验证码，继续进入 Cofounder。</p>
              <div style="margin:32px 0 0;padding:22px 16px;border:1px solid #2b2b2b;text-align:center;color:#ffffff;font-family:'Courier New',monospace;font-size:38px;font-weight:bold;letter-spacing:10px;">${otp}</div>
              <p style="margin:18px 0 0;color:#818181;font-size:13px;line-height:1.6;">验证码将在 10 分钟后失效。请勿转发给任何人。如果这不是你的操作，可以安全忽略这封邮件。</p>`,
            footerHtml:
                'Cofounder · AI 时代合伙人压力测试<br>这是一封账户安全邮件，不包含营销链接。',
        }),
    };
};
