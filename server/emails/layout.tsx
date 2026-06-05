import * as React from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

// On-brand chrome shared by every transactional email. Colours mirror the dw-* palette
// in client/src/index.css, but as literal hex (email clients can't read CSS variables and
// strip <style>/<link>, so every colour and layout rule has to be inline). Emails render
// on a LIGHT surface on purpose — robust across clients and immune to dark-mode inversion,
// while staying recognisably DejaWho through the indigo wordmark and cream accent.
export const brand = {
  pageBg: "#E9E8F3", // soft paper-dim wash behind the card
  cardBg: "#FFFFFF",
  border: "#DBD9EA", // --dw-paper-dim
  indigo: "#412DF0", // --dw-indigo
  indigoDeep: "#1C166D", // --dw-indigo-sub, for headings
  cream: "#FBEC5D", // --dw-cream accent bar
  ink: "#0E0A4A", // body text on light
  inkSoft: "#4A4570", // secondary / footer text
} as const;

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const text = {
  margin: "0 0 16px",
  fontSize: 15,
  lineHeight: "24px",
  color: brand.ink,
} as const;

export const heading = {
  margin: "0 0 16px",
  fontSize: 24,
  lineHeight: "30px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: brand.indigoDeep,
} as const;

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: brand.pageBg,
          margin: 0,
          padding: "32px 12px",
          fontFamily: fontStack,
        }}
      >
        <Container
          style={{
            width: "100%",
            maxWidth: 480,
            margin: "0 auto",
            backgroundColor: brand.cardBg,
            borderRadius: 16,
            border: `1px solid ${brand.border}`,
            overflow: "hidden",
          }}
        >
          {/* Wordmark. A typographic lockup, not an image — image-blocking clients can't
              break it. To use the real logo instead, drop in:
              <Img src={`${appUrl}/horizontal-lockup.png`} width="132" alt="DejaWho" /> */}
          <Section style={{ padding: "28px 32px 0" }}>
            <Text
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: brand.indigoDeep,
              }}
            >
              Deja<span style={{ color: brand.indigo }}>Who</span>
            </Text>
            <div
              style={{
                height: 3,
                width: 36,
                backgroundColor: brand.cream,
                borderRadius: 3,
                marginTop: 8,
              }}
            />
          </Section>

          <Section style={{ padding: "22px 32px 4px" }}>{children}</Section>

          <Hr style={{ borderColor: brand.border, margin: "8px 0 0" }} />
          <Section style={{ padding: "16px 32px 28px" }}>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: brand.inkSoft }}>
              DejaWho — remember the people you meet.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
