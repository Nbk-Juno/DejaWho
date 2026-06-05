import { describe, it, expect, vi } from "vitest";
import { render } from "@react-email/render";
import { createEmailer, sendWaitlistConfirmationSafe, type EmailClient } from "../server/email";
import { InviteEmail } from "../server/emails/invite";
import { WaitlistConfirmationEmail } from "../server/emails/waitlist-confirmation";

// A fake Resend client capturing the send payload. `new Resend()` would satisfy EmailClient,
// but the fake lets us assert on what was sent and simulate Resend's { error } failure shape.
function fakeClient(result: { error: { message: string } | null } = { error: null }) {
  const send = vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: result.error });
  return { client: { emails: { send } } as unknown as EmailClient, send };
}

describe("email templates", () => {
  it("renders the invite with a sign-in CTA pointing at APP_URL/sign-in", async () => {
    const html = await render(InviteEmail({ appUrl: "https://dejawho.io" }));
    expect(html).toContain("https://dejawho.io/sign-in");
    expect(html).toContain("just opened"); // body copy; apostrophes get HTML-escaped so avoid them
    expect(html).toContain("Sign in to DejaWho");
  });

  it("renders the waitlist confirmation without an action link", async () => {
    const html = await render(WaitlistConfirmationEmail({ appUrl: "https://dejawho.io" }));
    expect(html).toContain("on the list"); // heading; apostrophe in "You're" gets HTML-escaped
    expect(html).not.toContain("/sign-in");
  });
});

describe("createEmailer", () => {
  it("sends the invite with from/to/subject and rendered html + text", async () => {
    const { client, send } = fakeClient();
    const emailer = createEmailer(() => client);

    await emailer.sendInvite("tester@example.com");

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.to).toBe("tester@example.com");
    expect(payload.from).toMatch(/@/);
    expect(payload.subject).toMatch(/welcome to DejaWho/i);
    expect(payload.html).toContain("Sign in to DejaWho");
    expect(payload.text).toContain("Sign in to DejaWho"); // plaintext part rendered from the same template
  });

  it("sends the waitlist confirmation with its own subject", async () => {
    const { client, send } = fakeClient();
    const emailer = createEmailer(() => client);

    await emailer.sendWaitlistConfirmation("tester@example.com");

    const payload = send.mock.calls[0][0];
    expect(payload.subject).toMatch(/waitlist/i);
    expect(payload.html).toContain("on the list");
  });

  it("throws when Resend returns an error so callers can log/surface it", async () => {
    const { client } = fakeClient({ error: { message: "domain not verified" } });
    const emailer = createEmailer(() => client);

    await expect(emailer.sendInvite("tester@example.com")).rejects.toThrow(/domain not verified/);
  });
});

describe("sendWaitlistConfirmationSafe", () => {
  it("never throws synchronously, even with RESEND_API_KEY unset (fire-and-forget)", () => {
    // The Resend constructor throws synchronously without a key; the wrapper must capture that
    // so it can't escape into the request handler after the 200 has already been sent.
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      expect(() => sendWaitlistConfirmationSafe("tester@example.com")).not.toThrow();
    } finally {
      if (saved !== undefined) process.env.RESEND_API_KEY = saved;
    }
  });
});
