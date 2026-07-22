import type { authFr } from "./auth.fr"

// Namespace i18n « auth » (EN) — must mirror the keys of authFr.
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
      enterDemo: "Sign in",
      seeClientPortal: "View the client portal",
      footer: "Ocean · Studio Marea",
      featurePublish: "Multi-platform publishing",
      featureFeed: "Instagram feed preview",
      featureCalendar: "Editorial calendar",
      featureReview: "Client review",
      featureAgenda: "Unified agenda",
    },
    // Sign-in page (card).
    loginPage: {
      metaTitle: "Sign in",
      cardTitle: "Sign in",
      cardDescription: "Enter your email address and password.",
    },
    login: {
      emailLabel: "Email address",
      emailPlaceholder: "you@studio.com",
      passwordLabel: "Password",
      passwordPlaceholder: "••••••••",
      submit: "Sign in",
      submitting: "Signing in…",
      invalidCredentialsTitle: "Unable to sign in",
      invalidCredentialsDetail: "Incorrect email address or password.",
      forgotLink: "Forgot your password?",
    },
    // Reset request (email).
    forgot: {
      metaTitle: "Reset your password",
      cardTitle: "Forgot your password",
      cardDescription: "Enter your email address and we'll send you a reset link.",
      emailLabel: "Email address",
      emailPlaceholder: "you@studio.com",
      submit: "Send the link",
      submitting: "Sending…",
      sentTitle: "Email sent",
      sentDescription:
        "If an account exists for this address, a reset link is on its way. Check your spam folder too.",
      invalidEmail: "Invalid email address.",
      backToLogin: "Back to sign in",
    },
    // Choosing a new password (after clicking the link).
    reset: {
      metaTitle: "New password",
      cardTitle: "Choose a new password",
      cardDescription: "Your new password must be at least 8 characters.",
      passwordLabel: "New password",
      passwordPlaceholder: "••••••••",
      submit: "Update",
      submitting: "Updating…",
      errorTitle: "Update failed",
      weakPasswordDetail: "The password must be at least 8 characters.",
      genericDetail: "The link may have expired. Request a new reset email.",
    },
  },
}
