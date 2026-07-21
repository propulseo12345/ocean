import { Skeleton } from "@/components/ui/skeleton"

export default function PortalLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
