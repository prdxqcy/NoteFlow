const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"NoteFlow" <${process.env.SMTP_USER}>`;
const CLIENT_URL = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')[0]
  .trim();

async function sendWorkspaceInvite({ toEmail, workspaceName, inviterName, token }) {
  const link = `${CLIENT_URL}/register?invite=${token}`;

  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${inviterName} invited you to "${workspaceName}" on NoteFlow`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:8px;">
                <div style="width:32px;height:32px;background:#18181b;border-radius:8px;display:inline-block;"></div>
                <span style="font-size:18px;font-weight:700;color:#18181b;vertical-align:middle;">NoteFlow</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#18181b;">You're invited!</h1>
              <p style="margin:12px 0 0;font-size:15px;color:#52525b;line-height:1.6;">
                <strong style="color:#18181b;">${inviterName}</strong> has invited you to collaborate on
                <strong style="color:#18181b;">${workspaceName}</strong> in NoteFlow.
              </p>
              <p style="margin:8px 0 0;font-size:14px;color:#71717a;line-height:1.6;">
                Create your account to start collaborating on notes and meetings.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <a href="${link}"
                 style="display:block;width:100%;box-sizing:border-box;padding:14px 24px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;text-align:center;">
                Accept invitation &amp; create account
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;line-height:1.6;">
                Or copy this link:<br/>
                <span style="color:#71717a;word-break:break-all;">${link}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
                If you weren't expecting this invite, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    text: `${inviterName} invited you to "${workspaceName}" on NoteFlow.\n\nAccept your invitation: ${link}\n\nIf you weren't expecting this, ignore this email.`,
  });
}

module.exports = { sendWorkspaceInvite };
