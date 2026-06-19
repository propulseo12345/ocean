import { CalendarDays, CheckCircle2, Clock, LayoutGrid, Send, Waves } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { routes } from "@/lib/routes"

const FEATURES = [
  { icon: Send, label: "Publication multi-plateforme" },
  { icon: LayoutGrid, label: "Aperçu du feed Instagram" },
  { icon: CalendarDays, label: "Calendrier éditorial" },
  { icon: CheckCircle2, label: "Validation client" },
  { icon: Clock, label: "Agenda unifié" },
]

function BrandMark() {
  return (
    <Link href={routes.home} className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Waves className="size-5" />
      </span>
      <span className="font-heading text-lg font-bold">Ocean</span>
    </Link>
  )
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Panneau de marque — pleine hauteur sur desktop, en-tête sur mobile */}
      <aside className="relative flex shrink-0 flex-col overflow-hidden bg-sidebar px-6 py-6 text-sidebar-foreground lg:w-[44%] lg:max-w-2xl lg:px-12 lg:py-10">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 size-[40rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl lg:left-0 lg:-translate-x-1/3"
          style={{
            background: "radial-gradient(circle, var(--sidebar-primary) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <header className="relative z-10">
          <BrandMark />
        </header>

        <div className="relative z-10 mt-8 hidden flex-1 flex-col justify-center lg:flex">
          <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent/40 px-3 py-1 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-sidebar-primary" />
            Aperçu produit — données de démonstration
          </span>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance xl:text-4xl">
            Le poste de pilotage du freelance en communication
          </h1>
          <p className="mt-4 max-w-md text-balance text-sidebar-foreground/70">
            Planification, feed, calendrier, validation client et agenda — réunis dans un seul
            outil, sans la complexité.
          </p>

          <ul className="mt-10 flex flex-col gap-3 text-sm text-sidebar-foreground/80">
            {FEATURES.map((f) => (
              <li key={f.label} className="inline-flex items-center gap-2.5">
                <f.icon className="size-4 text-sidebar-primary" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative z-10 mt-auto hidden pt-8 text-xs text-sidebar-foreground/50 lg:block">
          Ocean · Studio Marea — preview front (UI seule, sans backend)
        </footer>
      </aside>

      {/* Carte de formulaire */}
      <main className="flex flex-1 items-center justify-center bg-background px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
