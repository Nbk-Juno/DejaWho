import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { EmailLayout, heading, text } from "./layout";

// Sent the moment someone joins the waitlist. Reassures them it landed and sets the
// expectation (invite-only, we'll reach out) — no link, nothing to do yet. Edit the copy
// freely; it's plain JSX.
export function WaitlistConfirmationEmail({ appUrl: _appUrl }: { appUrl: string }) {
  return (
    <EmailLayout preview="We've saved your spot — we'll be in touch when one opens.">
      <Heading as="h1" style={heading}>
        You're on the list
      </Heading>
      <Text style={text}>
        Thanks for your interest in DejaWho — the app that remembers the people you meet so you
        don't have to.
      </Text>
      <Text style={text}>
        We're opening up to a small invite list while the product learns from real encounters.
        Your spot is saved, and we'll email you the moment one opens up. Nothing to do until
        then.
      </Text>
      <Text style={{ ...text, marginBottom: 0 }}>— The DejaWho team</Text>
    </EmailLayout>
  );
}

export default WaitlistConfirmationEmail;
