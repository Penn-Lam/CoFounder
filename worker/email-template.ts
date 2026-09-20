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
        html: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cofounder 登录验证码</title>
</head>
<body style="margin:0;padding:0;background:#212121;color:#ffffff;font-family:Inter,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">你的 Cofounder 登录验证码是 ${otp}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#212121;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#131313;">
          <tr>
            <td style="padding:24px;color:#ffffff;font-family:'Courier New',monospace;font-size:18px;font-weight:bold;">
              <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:#ffffff;color:#131313;margin-right:12px;">C</span>
              COFOUNDER
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px;">
              <img src="https://react-email-demo-b2ks236lh-resend.vercel.app/static/dither/dither-image-1.png" width="592" alt="" style="display:block;width:100%;max-width:592px;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:48px 24px 56px;">
              <h1 style="margin:0;color:#ffffff;font-family:'Arial Narrow',Arial,sans-serif;font-size:48px;line-height:1;text-transform:uppercase;letter-spacing:-1px;">验证你的邮箱</h1>
              <p style="margin:20px 0 0;color:#c4c4c4;font-size:14px;line-height:1.6;">输入下面的 6 位验证码，继续进入 Cofounder。</p>
              <div style="margin:32px 0 0;padding:22px 16px;border:1px solid #2b2b2b;text-align:center;color:#ffffff;font-family:'Courier New',monospace;font-size:38px;font-weight:bold;letter-spacing:10px;">${otp}</div>
              <p style="margin:18px 0 0;color:#818181;font-size:13px;line-height:1.6;">验证码将在 10 分钟后失效。请勿转发给任何人。如果这不是你的操作，可以安全忽略这封邮件。</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;border-top:1px solid #2b2b2b;color:#818181;font-size:12px;line-height:1.6;">
              Cofounder · AI 时代合伙人压力测试<br>
              这是一封账户安全邮件，不包含营销链接。
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    };
};
