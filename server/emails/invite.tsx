import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import { brand, EmailLayout, heading, text } from "./layout";

// Sent when an email is added to the allow-list — the "you're in" moment. Carries the one
// action that matters: sign in. The CTA points at /sign-in (password or magic link); the
// recipient signs in with the address this was sent to.
export function InviteEmail({ appUrl }: { appUrl: string }) {
  const signInUrl = `${appUrl}/sign-in`;
  return (
    <EmailLayout preview="Your invite is ready — sign in and record your first encounter.">
      <Heading as="h1" style={heading}>
        You're in.
      </Heading>
      <Text style={text}>
        Good news — your spot on DejaWho just opened. You can sign in now and start recording
        the people you meet, then find them later by name, place, or the story of how you met.
      </Text>

      <Section style={{ padding: "8px 0 20px" }}>
        <Button
          href={signInUrl}
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
          Sign in to DejaWho
        </Button>
      </Section>

      <Text style={{ ...text, fontSize: 13, color: brand.inkSoft }}>
        Use this email address to sign in — with a password you set, or a one-tap magic link.
        If the button doesn't work, paste this into your browser:{" "}
        <span style={{ color: brand.indigo }}>{signInUrl}</span>
      </Text>
      <Text style={{ ...text, marginBottom: 0 }}>See you in there,
        <br />
        The DejaWho team
      </Text>
    </EmailLayout>
  );
}

export default InviteEmail;
