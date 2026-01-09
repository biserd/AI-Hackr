import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "AIHackr <onboarding@resend.dev>";

export async function sendMagicLinkEmail(email: string, magicLink: string): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Sign in to AIHackr",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 600;">AIHackr</h1>
            </div>
            
            <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600;">Sign in to your account</h2>
              <p style="margin: 0 0 24px; color: #a1a1aa; line-height: 1.6;">
                Click the button below to sign in to AIHackr. This link expires in 15 minutes.
              </p>
              
              <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500; font-size: 16px;">
                Sign in to AIHackr
              </a>
              
              <p style="margin: 24px 0 0; font-size: 14px; color: #71717a;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </div>
            
            <p style="margin: 24px 0 0; text-align: center; font-size: 12px; color: #52525b;">
              AIHackr - Reverse-engineer any SaaS stack
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("[Email] Failed to send magic link:", error);
      return false;
    }

    console.log(`[Email] Magic link sent to ${email}`);
    return true;
  } catch (error) {
    console.error("[Email] Error sending magic link:", error);
    return false;
  }
}

export async function sendChangeNotificationEmail(
  email: string,
  domain: string,
  changes: {
    added: string[];
    removed: string[];
    modified: Array<{ tech: string; from: string; to: string }>;
  },
  scanUrl: string
): Promise<boolean> {
  try {
    const changesList: string[] = [];
    
    if (changes.added.length > 0) {
      changesList.push(`<li style="margin-bottom: 8px;"><strong style="color: #22c55e;">Added:</strong> ${changes.added.join(", ")}</li>`);
    }
    if (changes.removed.length > 0) {
      changesList.push(`<li style="margin-bottom: 8px;"><strong style="color: #ef4444;">Removed:</strong> ${changes.removed.join(", ")}</li>`);
    }
    if (changes.modified.length > 0) {
      const modifiedItems = changes.modified.map(m => `${m.tech}: ${m.from} → ${m.to}`).join(", ");
      changesList.push(`<li style="margin-bottom: 8px;"><strong style="color: #f59e0b;">Changed:</strong> ${modifiedItems}</li>`);
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Stack changes detected on ${domain}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 600;">AIHackr</h1>
            </div>
            
            <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px;">
              <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600;">Stack Changes Detected</h2>
              <p style="margin: 0 0 24px; color: #a1a1aa;">
                We detected changes on <strong style="color: #ffffff;">${domain}</strong>
              </p>
              
              <ul style="margin: 0 0 24px; padding-left: 20px; color: #e4e4e7; line-height: 1.6;">
                ${changesList.join("")}
              </ul>
              
              <a href="${scanUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500; font-size: 16px;">
                View Full Report
              </a>
            </div>
            
            <p style="margin: 24px 0 0; text-align: center; font-size: 12px; color: #52525b;">
              You're receiving this because you subscribed to ${domain} on AIHackr.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("[Email] Failed to send change notification:", error);
      return false;
    }

    console.log(`[Email] Change notification sent to ${email} for ${domain}`);
    return true;
  } catch (error) {
    console.error("[Email] Error sending change notification:", error);
    return false;
  }
}
