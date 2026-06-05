import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import { brand, EmailLayout, heading, text } from "./layout";

// Sent when an email is added to the allow-list — the "you're in" moment. Carries the one
// action that matters: set up the account. The CTA deep-links to /sign-in in account-setup
// mode with this address pre-filled, so the (brand-new) recipient lands on "create a password"
// rather than a sign-in form that assumes an account they don't have yet.
export function InviteEmail({ appUrl, email }: { appUrl: string; email: string }) {
  const setupUrl = `${appUrl}/sign-in?mode=signup&email=${encodeURIComponent(email)}`;
  return (
    <EmailLayout preview="Your invite is ready — set up your account and record your first encounter.">
      <Heading as="h1" style={heading}>
        You're in.
      </Heading>
      <Text style={text}>
        Good news — your spot on DejaWho just opened. Set up your account and start recording
        the people you meet, then find them later by name, place, or the story of how you met.
      </Text>

      <Section style={{ padding: "8px 0 20px" }}>
        <Button
          href={setupUrl}
          style={{
            backgroundColor: brand.indigo,
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
            padding: "12px 22px",
            borderRadius: 10,
            display: "inline-block",
          }}
        >
          Set up your account
        </Button>
      </Section>

      <Text style={{ ...text, fontSize: 13, color: brand.inkSoft }}>
        Use this email address — you'll choose a password to finish setting up. If the button
        doesn't work, paste this into your browser:{" "}
        <span style={{ color: brand.indigo }}>{setupUrl}</span>
      </Text>
      <Text style={{ ...text, marginBottom: 0 }}>See you in there,
        <br />
        The DejaWho team
      </Text>
    </EmailLayout>
  );
}

export default InviteEmail;
