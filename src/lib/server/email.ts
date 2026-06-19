import { Resend } from 'resend'
import { env } from '$env/dynamic/private'

const resend = new Resend(env.RESEND_API_KEY)

export async function sendInviteEmail(to: string, projectName: string, link: string) {
  try {
    const result =await resend.emails.send({
        from: env.EMAIL_FROM_ADDRESS ?? 'onboarding@resend.dev',
        to,
      subject: `You've been invited to ${projectName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>You're invited!</h2>
          <p>You've been invited to join <strong>${projectName}</strong> on Project Manager.</p>
          <a href="${link}" style="display: inline-block; background: #06b6d4; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 12px;">
            Accept Invite
          </a>
          <p style="color: #888; font-size: 12px; margin-top: 20px;">This link expires in 7 days.</p>
        </div>
      `
    })
    console.log(result)
  } catch (err) {
    throw new Error('Failed to send invite email:', {cause : err})
  }
}