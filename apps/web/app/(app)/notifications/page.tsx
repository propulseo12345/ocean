import type { Metadata } from "next"
import { NotificationCenter } from "@/components/app/notifications/notification-center"
import { PageHeader } from "@/components/shared/page-header"
import { getNotifications, getUnreadCount } from "@/lib/mocks"

export const metadata: Metadata = { title: "Notifications" }

export default function NotificationsPage() {
  const notifications = getNotifications("owner")
  const unread = getUnreadCount("owner")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={
          unread > 0
            ? `${unread} non lue(s) — publications, validations et comptes à surveiller.`
            : "Publications, validations et comptes à surveiller."
        }
      />

      <NotificationCenter notifications={notifications} />
    </div>
  )
}
