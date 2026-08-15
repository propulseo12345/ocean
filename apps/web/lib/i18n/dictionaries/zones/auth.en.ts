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
      noAccount: "No account yet?",
      signUpLink: "Create one",
      inviteSent:
        "An email was just sent to the invited address. Open it to reach your review space.",
      inviteOtherAccount:
        "This invitation targets a different address than your current session. Sign out, then reopen the link.",
      inviteInvalid: "This invitation link is invalid, expired or already used.",
      authFailed: "The link expired or was already used. Please sign in again.",
      signupPending: "Account created. Confirm your email address, then sign in.",
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
    // Organization bootstrap (P7-3) - landing page for any account without an org.
    onboarding: {
      metaTitle: "Create your organization",
      cardTitle: "Create your organization",
      cardDescription:
        "Your account isn't linked to any organization yet. Give it a name to get started.",
      nameLabel: "Organization name",
      namePlaceholder: "Studio Marea",
      nameHelp: "This is the name your clients will see. You can change it later.",
      submit: "Create organization",
      submitting: "Creating…",
      errorTitle: "Could not create",
      invalidNameDetail: "The name must be between 1 and 120 characters.",
      genericDetail: "Try again in a moment. If the problem persists, contact support.",
      signOut: "Not my account - sign out",
    },
    // Sign-up (P7-4) - the /signup route did not exist.
    signup: {
      metaTitle: "Create an account",
      cardTitle: "Create an account",
      cardDescription: "A few seconds, and your workspace is ready.",
      nameLabel: "Your name",
      namePlaceholder: "Etienne Guimbard",
      nameHelp: "It also names your organization - you can change it later.",
      emailLabel: "Email address",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "••••••••",
      passwordHelp: "At least 8 characters.",
      submit: "Create my account",
      submitting: "Creating…",
      errorTitle: "Sign-up failed",
      invalidFormatDetail:
        "Check your name, email address and a password of at least 8 characters.",
      genericDetail: "This address may already be in use. Try signing in.",
      haveAccount: "Already have an account?",
      signInLink: "Sign in",
    },
    invitation: {
      metaTitle: "Invitation",
      joinTitle: "Join {client}?",
      joinDescription:
        "You have been invited to review content for {client}. Nobody is added until you confirm.",
      joinSubmit: "Join {client}",
      joinSubmitting: "Joining…",
      notMe: "This is not what I want",
      proofTitle: "Confirm your address",
      proofDescription:
        "To join this workspace, sign in with the address that received the invitation. We will email you the link.",
      proofSubmit: "Email me the sign-in link",
      proofSubmitting: "Sending…",
      proofSentTitle: "Check your inbox",
      proofSentDescription:
        "If this invitation is valid, a sign-in link has just been sent to the invited address. Remember to check your spam folder.",
      wrongAccountTitle: "Wrong account",
      wrongAccountDescription:
        "You are signed in as {courant}, but this invitation targets a different address. Sign out, then reopen the link.",
      signOut: "Sign out",
      invalidTitle: "Link no longer usable",
      invalidDescription:
        "This invitation link is no longer valid. It may have expired, been revoked, or already been used. Ask for a new invitation.",
      backToLogin: "Back to sign-in",
      errorTitle: "Could not join",
      crossSiteDetail:
        "This request did not come from Ocean. It has been refused for your safety. Reopen the link from your email.",
      genericDetail: "Try again in a moment. If the problem persists, contact your agency.",
    },
  },
}
