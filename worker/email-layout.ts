type EmailLayoutInput = {
    title: string;
    preheader: string;
    bodyHtml: string;
    footerHtml: string;
};

export const renderEmailLayout = ({
    title,
    preheader,
    bodyHtml,
    footerHtml,
}: EmailLayoutInput) => `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#212121;color:#ffffff;font-family:Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#212121;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#131313;">
        <tr><td style="padding:24px;color:#ffffff;font-family:'Courier New',monospace;font-size:18px;font-weight:bold;"><span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:#ffffff;color:#131313;margin-right:12px;">C</span>COFOUNDER</td></tr>
        <tr><td style="padding:0 24px;"><img src="https://react-email-demo-b2ks236lh-resend.vercel.app/static/dither/dither-image-1.png" width="592" alt="" style="display:block;width:100%;max-width:592px;height:auto;border:0;"></td></tr>
        <tr><td style="padding:48px 24px 56px;">${bodyHtml}</td></tr>
        <tr><td style="padding:32px 24px;border-top:1px solid #2b2b2b;color:#818181;font-size:12px;line-height:1.6;">${footerHtml}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
