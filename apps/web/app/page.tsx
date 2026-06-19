import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Send,
  Waves,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { routes } from "@/lib/routes"

const FEATURES = [
  { icon: Send, label: "Publication multi-plateforme" },
  { icon: LayoutGrid, label: "Aperçu du feed Instagram" },
  { icon: CalendarDays, label: "Calendrier éditorial" },
  { icon: CheckCircle2, label: "Validation client" },
  { icon: Clock, label: "Agenda unifié" },
]

export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[44rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--sidebar-primary) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Waves className="size-5" />
          </span>
          <span className="font-heading text-lg font-bold">Ocean</span>
        </div>
        <Button
          variant="ghost"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          render={<Link href={routes.login} />}
        >
          Connexion
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent/40 px-3 py-1 text-xs font-medium">
          <span className="size-1.5 rounded-full bg-sidebar-primary" />
          Aperçu produit — données de démonstration
        </span>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Le poste de pilotage du freelance en communication
        </h1>
        <p className="mt-5 max-w-xl text-balance text-sidebar-foreground/70">
          Tout ce qu'une agence fait dans cinq outils — planification, feed, calendrier, validation
          client et agenda — réuni dans un seul, sans la complexité.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" render={<Link href={routes.dashboard} />}>
            Entrer dans la démo
            <ArrowRight />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            render={<Link href={routes.portal} />}
          >
            Voir le portail client
          </Button>
        </div>

        <ul className="mt-14 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-sidebar-foreground/60">
          {FEATURES.map((f) => (
            <li key={f.label} className="inline-flex items-center gap-1.5">
              <f.icon className="size-4 text-sidebar-primary" />
              {f.label}
            </li>
          ))}
        </ul>
      </main>

      <footer className="relative z-10 px-6 py-5 text-center text-xs text-sidebar-foreground/50">
        Ocean · Studio Marea — preview front (UI seule, sans backend)
      </footer>
    </div>
  )
}
