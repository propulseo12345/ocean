import { type L, loc } from "@/lib/i18n"
import type { Client } from "./types"

export interface Copy {
  title: string
  caption: string
  hashtags: string[]
}

type Theme = Client["theme"]

export const COPY_POOL: Record<Theme, Copy[]> = {
  coffee: [
    {
      title: loc("Nouveau single-origin Éthiopie", "New Ethiopian single-origin"),
      caption: loc(
        "Notes de jasmin et de bergamote — notre nouvel Éthiopie Yirgacheffe est en boutique. ☕️ Venez le déguster en filtre ce week-end.",
        "Notes of jasmine and bergamot — our new Ethiopia Yirgacheffe just landed in store. ☕️ Come taste it as a pour-over this weekend."
      ),
      hashtags: ["#cafédespécialité", "#singleorigin", "#brûlerie"],
    },
    {
      title: loc("Latte art du samedi", "Saturday latte art"),
      caption: loc(
        "Le geste, la mousse, le détail. Petit moment de calme avant le rush du matin.",
        "The pour, the foam, the detail. A quiet little moment before the morning rush."
      ),
      hashtags: ["#latteart", "#barista", "#coffeelover"],
    },
    {
      title: loc("Atelier dégustation", "Tasting workshop"),
      caption: loc(
        "On ouvre les portes de la brûlerie : atelier dégustation guidée, 6 cafés, 1h30. Places limitées, lien en bio.",
        "We're opening the roastery doors: a guided tasting workshop, 6 coffees, 90 minutes. Limited spots, link in bio."
      ),
      hashtags: ["#atelier", "#cupping", "#café"],
    },
    {
      title: loc("Coulisses de la torréfaction", "Behind the roast"),
      caption: loc(
        "De la cerise verte à la tasse : 12 minutes qui changent tout. On vous montre.",
        "From green cherry to cup: the 12 minutes that change everything. Let us show you."
      ),
      hashtags: ["#torréfaction", "#savoirfaire", "#coffeeroaster"],
    },
    {
      title: loc("Le cold brew est de retour", "Cold brew is back"),
      caption: loc(
        "Infusé 18 h à froid, doux et puissant. La boisson de l'été revient en bouteille.",
        "Steeped cold for 18 hours, smooth yet bold. Summer's signature drink is back in bottles."
      ),
      hashtags: ["#coldbrew", "#été", "#caféglacé"],
    },
    {
      title: loc("Portrait producteur", "Producer spotlight"),
      caption: loc(
        "Rencontre avec Tadesse, qui cultive notre lot du Sidamo à 2 000 m d'altitude.",
        "Meet Tadesse, who grows our Sidamo lot at 2,000 m above sea level."
      ),
      hashtags: ["#directtrade", "#producteur", "#éthiopie"],
    },
  ],
  food: [
    {
      title: loc("Menu de saison — printemps", "Seasonal menu — spring"),
      caption: loc(
        "Asperges vertes, œuf parfait, noisette torréfiée. Le nouveau menu déjeuner arrive lundi.",
        "Green asparagus, perfect egg, toasted hazelnut. The new lunch menu drops Monday."
      ),
      hashtags: ["#menudesaison", "#fooddesign", "#restaurant"],
    },
    {
      title: loc("Brunch du dimanche", "Sunday brunch"),
      caption: loc(
        "Le brunch revient ! Pancakes, granola maison, jus pressés. Réservation conseillée.",
        "Brunch is back! Pancakes, house-made granola, fresh-pressed juices. Booking recommended."
      ),
      hashtags: ["#brunch", "#dimanche", "#foodie"],
    },
    {
      title: loc("Dans les coulisses en cuisine", "Behind the scenes in the kitchen"),
      caption: loc(
        "Le coup de feu vu de l'intérieur. Bravo à toute la brigade. 👏",
        "The dinner rush from the inside. Hats off to the whole crew. 👏"
      ),
      hashtags: ["#cuisine", "#chef", "#behindthescenes"],
    },
    {
      title: loc("Notre dessert signature", "Our signature dessert"),
      caption: loc(
        "Tarte au citron revisitée, meringue brûlée minute. Une institution maison.",
        "Our reimagined lemon tart, meringue torched to order. A house classic."
      ),
      hashtags: ["#dessert", "#pâtisserie", "#gourmandise"],
    },
    {
      title: loc("Accord mets & vins", "Food & wine pairing"),
      caption: loc(
        "Ce soir, on accorde le plat du jour avec un nature du Languedoc. Venez tester.",
        "Tonight we're pairing the daily special with a natural wine from Languedoc. Come give it a try."
      ),
      hashtags: ["#vinnature", "#accordmetsvins", "#bistrot"],
    },
    {
      title: loc("Produits du marché", "Straight from the market"),
      caption: loc(
        "Direct du marché ce matin : tout part de là. Le menu suit la saison, pas l'inverse.",
        "Straight from the market this morning: it all starts here. The menu follows the season, not the other way around."
      ),
      hashtags: ["#circuitcourt", "#marché", "#localfood"],
    },
  ],
  fashion: [
    {
      title: loc("Drop printemps — pièce 01", "Spring drop — piece 01"),
      caption: loc(
        "La veste oversize en lin lavé. Coupe fluide, teinte argile. Disponible vendredi.",
        "The oversized washed-linen jacket. Relaxed cut, clay tone. Available Friday."
      ),
      hashtags: ["#nouvellecollection", "#mode", "#slowfashion"],
    },
    {
      title: loc("Flatlay total look", "Total-look flatlay"),
      caption: loc(
        "Comment porter la maille côtelée en mi-saison : 3 pièces, 1 silhouette.",
        "How to wear ribbed knit in between seasons: 3 pieces, 1 silhouette."
      ),
      hashtags: ["#flatlay", "#ootd", "#stylinginspo"],
    },
    {
      title: loc("Atelier — les coulisses", "The studio — behind the scenes"),
      caption: loc(
        "Chaque pièce passe par nos mains. Patronage, coupe, finitions : tout se joue à l'atelier.",
        "Every piece passes through our hands. Patterns, cutting, finishing: it all happens in the studio."
      ),
      hashtags: ["#madeinfrance", "#atelier", "#couture"],
    },
    {
      title: loc("Accessoires de la semaine", "Accessories of the week"),
      caption: loc(
        "Le sac en cuir tanné végétal, fait pour durer. Édition limitée.",
        "The vegetable-tanned leather bag, built to last. Limited edition."
      ),
      hashtags: ["#accessoires", "#cuir", "#éditionlimitée"],
    },
    {
      title: loc("Lookbook — nuances sable", "Lookbook — sand tones"),
      caption: loc(
        "La palette de la saison : sable, écru, terracotta. Le lookbook complet en story.",
        "This season's palette: sand, ecru, terracotta. The full lookbook is in our story."
      ),
      hashtags: ["#lookbook", "#palette", "#minimalstyle"],
    },
    {
      title: loc("Nos clientes, nos muses", "Our customers, our muses"),
      caption: loc(
        "Repostez vos looks avec #AtelierNove, on adore vous voir les porter.",
        "Repost your looks with #AtelierNove — we love seeing you wear them."
      ),
      hashtags: ["#communauté", "#ugc", "#styleinspo"],
    },
  ],
  yoga: [
    {
      title: loc("Cours du matin — Vinyasa", "Morning class — Vinyasa"),
      caption: loc(
        "On démarre la semaine en douceur. Vinyasa lent, focus respiration. 7 h, en studio et en ligne.",
        "Ease into the week. Slow Vinyasa, breath-focused. 7 a.m., in studio and online."
      ),
      hashtags: ["#yoga", "#vinyasa", "#bienêtre"],
    },
    {
      title: loc("Posture de la semaine", "Pose of the week"),
      caption: loc(
        "Vrksasana, l'arbre. Ancrage, équilibre, patience. On décompose le placement.",
        "Vrksasana, tree pose. Grounding, balance, patience. We break down the alignment."
      ),
      hashtags: ["#postureyoga", "#équilibre", "#yogapractice"],
    },
    {
      title: loc("Atelier respiration", "Breathwork workshop"),
      caption: loc(
        "Pranayama & cohérence cardiaque, 90 min pour relâcher la pression. Samedi.",
        "Pranayama & heart-coherence breathing, 90 minutes to release the pressure. Saturday."
      ),
      hashtags: ["#pranayama", "#respiration", "#mindfulness"],
    },
    {
      title: loc("Nouvelle prof — bienvenue Inès", "New teacher — welcome Inès"),
      caption: loc(
        "Inès rejoint le studio pour les cours du soir. Yin & restorative, sa spécialité.",
        "Inès joins the studio for evening classes. Yin & restorative, her specialty."
      ),
      hashtags: ["#équipe", "#yinyoga", "#studio"],
    },
    {
      title: loc("Retraite de printemps", "Spring retreat"),
      caption: loc(
        "Deux jours hors du temps : yoga, marche, silence. Inscriptions ouvertes, lien en bio.",
        "Two days out of time: yoga, walking, silence. Registration open, link in bio."
      ),
      hashtags: ["#retraite", "#ressourcement", "#nature"],
    },
    {
      title: loc("Méditation guidée du soir", "Guided evening meditation"),
      caption: loc(
        "10 minutes pour déposer la journée. Disponible en replay pour les membres.",
        "10 minutes to set the day down. Available on replay for members."
      ),
      hashtags: ["#méditation", "#sommeil", "#calme"],
    },
  ],
}
