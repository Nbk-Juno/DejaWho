import type { ReactElement } from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { logError, logInfo } from "./logger";
import { InviteEmail } from "./emails/invite";
import { WaitlistConfirmationEmail } from "./emails/waitlist-confirmation";

// The slice of the Resend SDK this module uses. `Pick` keeps the SDK's exact signature — so
// `new Resend(...)` satisfies it for free — while naming the seam a test fake targets, letting
// the render/send logic below be unit-tested without hitting Resend. Mirrors server/openai.ts.
export type EmailClient = Pick<Resend, "emails">;

let _default: Resend | null = null;
function defaultClient(): EmailClient {
  // Lazy like the OpenAI client: the SDK (and the API key it wants) isn't needed until a send
  // actually happens, so importing this module never requires RESEND_API_KEY (tests, build).
  if (!_default) _default = new Resend(process.env.RESEND_API_KEY);
  return _default;
}

// Any address on the verified Resend domain works — no real mailbox required.
function from(): string {
  return process.env.EMAIL_FROM ?? "DejaWho <hello@dejawho.io>";
}

function appUrl(): string {
  return process.env.APP_URL ?? "https://dejawho.io";
}

// All app email, bound to an injectable client. The app uses the default lazy client; tests
// pass a fake to exercise the real render/send logic. `getClient` is a thunk so the default
// stays lazy.
export function createEmailer(getClient: () => EmailClient = defaultClient) {
  async function send(to: string, subject: string, element: ReactElement): Promise<void> {
    // Render both representations from the one template so the plaintext part always matches.
    const [html, plainText] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);
    const { error } = await getClient().emails.send({ from: from(), to, subject, html, text: plainText });
    if (error) throw new Error(`resend_send_failed: ${error.message ?? String(error)}`);
  }

  function sendWaitlistConfirmation(to: string): Promise<void> {
    return send(
      to,
      "You're on the DejaWho waitlist",
      WaitlistConfirmationEmail({ appUrl: appUrl() }),
    );
  }

  function sendInvite(to: string): Promise<void> {
    return send(to, "You're in — welcome to DejaWho", InviteEmail({ appUrl: appUrl() }));
  }

  return { sendWaitlistConfirmation, sendInvite };
}

const emailer = createEmailer();
export const sendWaitlistConfirmation = emailer.sendWaitlistConfirmation;
export const sendInvite = emailer.sendInvite;

// Fire-and-forget wrapper for the user-facing path: joining the waitlist must not block on
// (or fail because of) the confirmation email. Logs the outcome and swallows errors.
//
// Starting the chain with `Promise.resolve().then(...)` is load-bearing: it funnels a
// *synchronous* throw into the same `.catch`. The Resend constructor throws synchronously when
// RESEND_API_KEY is unset, so calling `sendWaitlistConfirmation(to)` directly would throw
// before `.catch` is attached and escape into the request handler after the 200 was already
// sent. This keeps the path truly non-blocking even when email is unconfigured.
export function sendWaitlistConfirmationSafe(to: string): void {
  void Promise.resolve()
    .then(() => sendWaitlistConfirmation(to))
    .then(() => logInfo("waitlist_email_sent", { to }))
    .catch((err) => logError("waitlist_email_failed", err, { to }));
}
