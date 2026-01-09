import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "AIHackr <hello@aihackr.com>";

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
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: #f8fafc; color: #1e293b; padding: 40px 20px; margin: 0; line-height: 1.6;">
          <div style="max-width: 480px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; margin-bottom: 16px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.25);">
                <span style="font-size: 24px; color: white; font-weight: bold;">A</span>
              </div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #0f172a;">AIHackr</h1>
            </div>
            
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
              <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #0f172a;">Welcome back!</h2>
              <p style="margin: 0 0 28px; color: #64748b; font-size: 15px;">
                Click the button below to securely sign in to your AIHackr account. This link will expire in 15 minutes.
              </p>
              
              <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3); transition: transform 0.2s;">
                Sign in to AIHackr
              </a>
              
              <div style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                  If you didn't request this email, you can safely ignore it. Someone may have entered your email address by mistake.
                </p>
              </div>
            </div>
            
            <div style="margin-top: 32px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8;">
                Reverse-engineer any SaaS tech stack
              </p>
              <p style="margin: 0; font-size: 12px; color: #cbd5e1;">
                aihackr.com
              </p>
            </div>
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
      changesList.push(`<li style="margin-bottom: 10px; padding-left: 8px;"><span style="display: inline-block; width: 8px; height: 8px; background: #22c55e; border-radius: 50%; margin-right: 10px;"></span><strong style="color: #166534;">Added:</strong> <span style="color: #475569;">${changes.added.join(", ")}</span></li>`);
    }
    if (changes.removed.length > 0) {
      changesList.push(`<li style="margin-bottom: 10px; padding-left: 8px;"><span style="display: inline-block; width: 8px; height: 8px; background: #ef4444; border-radius: 50%; margin-right: 10px;"></span><strong style="color: #dc2626;">Removed:</strong> <span style="color: #475569;">${changes.removed.join(", ")}</span></li>`);
    }
    if (changes.modified.length > 0) {
      const modifiedItems = changes.modified.map(m => `${m.tech}: ${m.from} → ${m.to}`).join(", ");
      changesList.push(`<li style="margin-bottom: 10px; padding-left: 8px;"><span style="display: inline-block; width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; margin-right: 10px;"></span><strong style="color: #d97706;">Changed:</strong> <span style="color: #475569;">${modifiedItems}</span></li>`);
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
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: #f8fafc; color: #1e293b; padding: 40px 20px; margin: 0; line-height: 1.6;">
          <div style="max-width: 480px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; margin-bottom: 16px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.25);">
                <span style="font-size: 24px; color: white; font-weight: bold;">A</span>
              </div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #0f172a;">AIHackr</h1>
            </div>
            
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
              <div style="display: inline-block; background: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
                Stack Update
              </div>
              <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #0f172a;">Changes detected</h2>
              <p style="margin: 0 0 24px; color: #64748b; font-size: 15px;">
                We found tech stack changes on <strong style="color: #0f172a;">${domain}</strong>
              </p>
              
              <ul style="margin: 0 0 28px; padding: 0; list-style: none;">
                ${changesList.join("")}
              </ul>
              
              <a href="${scanUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);">
                View Full Report
              </a>
            </div>
            
            <div style="margin-top: 32px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8;">
                You're tracking ${domain} on AIHackr
              </p>
              <p style="margin: 0; font-size: 12px; color: #cbd5e1;">
                aihackr.com
              </p>
            </div>
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
