import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LocaleProvider } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"
import "./globals.css"

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] })
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
})

export async function generateMetadata(): Promise<Metadata> {
  const { getT } = await import("@/lib/i18n/server")
  const t = await getT()
  return {
    title: {
      default: t("meta.appTitleDefault"),
      template: "%s · Ocean",
    },
    description: t("meta.appDescription"),
    applicationName: "Ocean",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Ocean" },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f3d63" },
    { media: "(prefers-color-scheme: dark)", color: "#0b2238" },
  ],
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <LocaleProvider initialLocale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider delay={200}>
              {children}
              <Toaster position="top-right" />
            </TooltipProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
