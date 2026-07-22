// Source unique des chemins de l'app → liens cohérents dans tous les écrans.
export const routes = {
  home: "/",
  dashboard: "/dashboard",
  agenda: "/agenda",
  clients: "/clients",
  clientNew: "/clients/new",
  settings: "/settings/accounts",
  notifications: "/notifications",
  portal: "/portal",
  login: "/login",
  client: (id: string) => `/clients/${id}`,
  clientGrid: (id: string) => `/clients/${id}/grid`,
  clientCalendar: (id: string) => `/clients/${id}/calendar`,
  clientContent: (id: string) => `/clients/${id}/content`,
  clientLibrary: (id: string) => `/clients/${id}/library`,
  clientIdeas: (id: string) => `/clients/${id}/ideas`,
  clientPerformance: (id: string) => `/clients/${id}/performance`,
  clientReport: (id: string) => `/clients/${id}/report`,
  clientSettings: (id: string) => `/clients/${id}/settings`,
  content: (clientId: string, contentId: string) => `/clients/${clientId}/content/${contentId}`,
  contentNew: (clientId: string) => `/clients/${clientId}/content/new`,
  contentEdit: (clientId: string, contentId: string) =>
    `/clients/${clientId}/content/${contentId}/edit`,
  portalContent: (contentId: string) => `/portal/${contentId}`,
  /** Lien d'acceptation d'invitation reviewer (Route Handler, token usage unique). */
  acceptInvite: (token: string) => `/api/invitations/accept?token=${encodeURIComponent(token)}`,
} as const
