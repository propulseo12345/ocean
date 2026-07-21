import type { Metadata } from "next"
import { NotificationCenter } from "@/components/app/notifications/notification-center"
import { PageHeader } from "@/components/shared/page-header"
import { getActiveOrg } from "@/lib/auth/org-context"
import { getNotifications, getUnreadCount } from "@/lib/data"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("notifications.metaTitle") }
}

export default async function NotificationsPage() {
  const t = await getT()
  const ctx = await getActiveOrg()
  const notifications = await getNotifications(ctx.org.id, "owner")
  const unread = await getUnreadCount(ctx.org.id, "owner")

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("notifications.pageTitle")}
        description={
          unread > 0
            ? t("notifications.pageDescriptionUnread", { count: unread })
            : t("notifications.pageDescription")
        }
      />

      <NotificationCenter notifications={notifications} />
    </div>
  )
}
