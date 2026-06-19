import type { authFr } from "./auth.fr"

// Namespace i18n « auth » (EN) — doit refléter les clés de authFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const authEn: Widen<typeof authFr> = {
  auth: {
    // Landing header — sign-in button.
    signIn: "Sign in",
    // Public landing + brand panel (auth layout).
    landing: {
      previewBadge: "Product preview — sample data",
      heroTitle: "The command center for communications freelancers",
      heroLead:
        "Everything an agency does across five tools — scheduling, feed, calendar, client review and agenda — brought together in one, without the complexity.",
      heroLeadShort:
        "Scheduling, feed, calendar, client review and agenda — together in a single tool, without the complexity.",
      enterDemo: "Enter the demo",
      seeClientPortal: "View the client portal",
      footer: "Ocean · Studio Marea — front-end preview (UI only, no backend)",
      featurePublish: "Multi-platform publishing",
      featureFeed: "Instagram feed preview",
      featureCalendar: "Editorial calendar",
      featureReview: "Client review",
      featureAgenda: "Unified agenda",
    },
    // Sign-in page (card).
    loginPage: {
      metaTitle: "Sign in",
      cardTitle: "Access the demo",
      cardDescription:
        "Product preview with sample data. Enter in one click, or simulate a passwordless sign-in.",
    },
    // OTP page (card).
    otpPage: {
      metaTitle: "Verification",
      cardTitle: "Enter your code",
      cardDescription: "Enter the 6-digit code sent to your email address.",
      changeEmail: "Change email address",
    },
    login: {
      demoToastTitle: "Welcome to the Ocean demo",
      demoToastDetail: "Demo account — sample data.",
      invalidEmailTitle: "Invalid email address",
      invalidEmailDetail: "Enter a valid address to continue.",
      magicLinkToastTitle: "Magic link validated (preview)",
      magicLinkToastDetail: "Simulated sign-in for {email} — entering the demo.",
      otpToastTitle: "Code sent (preview)",
      otpToastDetail: "Simulated action — enter any 6-digit code.",
      enterDemo: "Enter the demo",
      orSimulate: "or simulate a sign-in",
      emailLabel: "Email address",
      emailPlaceholder: "you@studio.com",
      sendMagicLink: "Send me the magic link",
      sendOtp: "Send me a 6-digit code",
      hintDesktopPrefix: "On desktop, the ",
      hintDesktopBold: "magic link",
      hintDesktopSuffix: " is the easiest.",
      hintMobilePrefix: "On mobile, prefer the ",
      hintMobileBold: "6-digit code",
      hintMobileSuffix: ".",
    },
    otp: {
      incompleteTitle: "Incomplete code",
      incompleteDetail: "Enter the 6 digits sent to your email.",
      verifiedTitle: "Code verified (preview)",
      verifiedDetail: "Simulated action — redirecting to the dashboard.",
      resentTitle: "New code sent (preview)",
      resentDetail: "Simulated action — a code has been resent.",
      codeLabel: "6-digit code",
      digitAriaLabel: "Digit {index} of {total}",
      verify: "Verify",
      noCode: "Didn't get anything?",
      resend: "Resend the code",
    },
  },
}
