import nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import { env } from '$env/dynamic/private';

const transport = nodemailer.createTransport(
	MailtrapTransport({
		token: env.MAILTRAP_TOKEN!
	})
);

export async function sendInviteEmail(to: string, projectName: string, link: string) {
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <tr>
            <td style="background:#171717;border-radius:12px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.4);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:8px;">
                    <span style="color:#06b6d4;font-size:14px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Project Manager</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0;">
                    <h1 style="color:#fafafa;font-size:22px;font-weight:600;margin:0;line-height:1.3;">You're invited to join a project</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 0 20px;">
                    <p style="color:#a3a3a3;font-size:15px;line-height:1.6;margin:0;">
                      <strong style="color:#e5e5e5;">${projectName}</strong>
                    </p>
                    <p style="color:#a3a3a3;font-size:14px;line-height:1.6;margin:8px 0 0;">
                      Click the button below to accept the invitation and get started.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0 24px;">
                    <a href="${link}" style="display:inline-block;background:#06b6d4;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
                      Accept Invite &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #262626;padding-top:20px;">
                    <p style="color:#525252;font-size:12px;margin:0;">
                      This link expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

	try {
		await transport.sendMail({
			from: { address: env.EMAIL_FROM_ADDRESS ?? 'hello@demomailtrap.co', name: 'Project Manager' },
			to,
			subject: `You've been invited to ${projectName}`,
			html
		});
	} catch (err) {
		throw new Error('Failed to send invite email:', { cause: err });
	}
}
