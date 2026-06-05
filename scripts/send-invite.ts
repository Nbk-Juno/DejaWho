import "dotenv/config";
import { sendInvite } from "../server/email";

// Manual invite send / resend backstop. The Database Webhook is the happy path; this is how
// you re-send when a webhook missed (e.g. Render was cold and pg_net timed out — it does not
// retry), or send an invite by hand. Does NOT touch whitelisted_emails — grant access
// separately. Usage: npm run invite -- you@example.com
async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email || !email.includes("@")) {
    console.error("usage: npm run invite -- you@example.com");
    process.exit(1);
  }
  await sendInvite(email);
  console.log(`invite sent to ${email}`);
}

main().catch((err) => {
  console.error("invite failed:", err);
  process.exit(1);
});
