import type { SVGProps } from "react"

// Glyphes fournisseurs d'agenda (lucide ne fournit pas ces marques).
// Monochromes (currentColor) — alignés sur le style des brand-icons partagés,
// pour rester cohérents avec les 2 thèmes et éviter toute couleur en dur.
function Glyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  )
}

export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M21.5 12.2c0-.7-.06-1.36-.18-2H12v3.78h5.34a4.57 4.57 0 0 1-1.98 3v2.5h3.2c1.87-1.73 2.94-4.28 2.94-7.28Z" />
      <path d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.2-2.5c-.9.6-2.05.96-3.42.96-2.63 0-4.85-1.78-5.64-4.16H3.05v2.58A10 10 0 0 0 12 22Z" />
      <path d="M6.36 13.88a6 6 0 0 1 0-3.76V7.54H3.05a10 10 0 0 0 0 8.92l3.31-2.58Z" />
      <path d="M12 5.96c1.48 0 2.8.51 3.85 1.51l2.84-2.84A10 10 0 0 0 3.05 7.54l3.31 2.58C7.15 7.74 9.37 5.96 12 5.96Z" />
    </Glyph>
  )
}

export function MicrosoftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </Glyph>
  )
}
