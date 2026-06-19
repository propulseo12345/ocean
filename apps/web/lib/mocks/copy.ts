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
      title: "Nouveau single-origin Éthiopie",
      caption:
        "Notes de jasmin et de bergamote — notre nouvel Éthiopie Yirgacheffe est en boutique. ☕️ Venez le déguster en filtre ce week-end.",
      hashtags: ["#cafédespécialité", "#singleorigin", "#brûlerie"],
    },
    {
      title: "Latte art du samedi",
      caption: "Le geste, la mousse, le détail. Petit moment de calme avant le rush du matin.",
      hashtags: ["#latteart", "#barista", "#coffeelover"],
    },
    {
      title: "Atelier dégustation",
      caption:
        "On ouvre les portes de la brûlerie : atelier dégustation guidée, 6 cafés, 1h30. Places limitées, lien en bio.",
      hashtags: ["#atelier", "#cupping", "#café"],
    },
    {
      title: "Coulisses de la torréfaction",
      caption: "De la cerise verte à la tasse : 12 minutes qui changent tout. On vous montre.",
      hashtags: ["#torréfaction", "#savoirfaire", "#coffeeroaster"],
    },
    {
      title: "Le cold brew est de retour",
      caption: "Infusé 18 h à froid, doux et puissant. La boisson de l'été revient en bouteille.",
      hashtags: ["#coldbrew", "#été", "#caféglacé"],
    },
    {
      title: "Portrait producteur",
      caption: "Rencontre avec Tadesse, qui cultive notre lot du Sidamo à 2 000 m d'altitude.",
      hashtags: ["#directtrade", "#producteur", "#éthiopie"],
    },
  ],
  food: [
    {
      title: "Menu de saison — printemps",
      caption:
        "Asperges vertes, œuf parfait, noisette torréfiée. Le nouveau menu déjeuner arrive lundi.",
      hashtags: ["#menudesaison", "#fooddesign", "#restaurant"],
    },
    {
      title: "Brunch du dimanche",
      caption: "Le brunch revient ! Pancakes, granola maison, jus pressés. Réservation conseillée.",
      hashtags: ["#brunch", "#dimanche", "#foodie"],
    },
    {
      title: "Dans les coulisses en cuisine",
      caption: "Le coup de feu vu de l'intérieur. Bravo à toute la brigade. 👏",
      hashtags: ["#cuisine", "#chef", "#behindthescenes"],
    },
    {
      title: "Notre dessert signature",
      caption: "Tarte au citron revisitée, meringue brûlée minute. Une institution maison.",
      hashtags: ["#dessert", "#pâtisserie", "#gourmandise"],
    },
    {
      title: "Accord mets & vins",
      caption: "Ce soir, on accorde le plat du jour avec un nature du Languedoc. Venez tester.",
      hashtags: ["#vinnature", "#accordmetsvins", "#bistrot"],
    },
    {
      title: "Produits du marché",
      caption:
        "Direct du marché ce matin : tout part de là. Le menu suit la saison, pas l'inverse.",
      hashtags: ["#circuitcourt", "#marché", "#localfood"],
    },
  ],
  fashion: [
    {
      title: "Drop printemps — pièce 01",
      caption: "La veste oversize en lin lavé. Coupe fluide, teinte argile. Disponible vendredi.",
      hashtags: ["#nouvellecollection", "#mode", "#slowfashion"],
    },
    {
      title: "Flatlay total look",
      caption: "Comment porter la maille côtelée en mi-saison : 3 pièces, 1 silhouette.",
      hashtags: ["#flatlay", "#ootd", "#stylinginspo"],
    },
    {
      title: "Atelier — les coulisses",
      caption:
        "Chaque pièce passe par nos mains. Patronage, coupe, finitions : tout se joue à l'atelier.",
      hashtags: ["#madeinfrance", "#atelier", "#couture"],
    },
    {
      title: "Accessoires de la semaine",
      caption: "Le sac en cuir tanné végétal, fait pour durer. Édition limitée.",
      hashtags: ["#accessoires", "#cuir", "#éditionlimitée"],
    },
    {
      title: "Lookbook — nuances sable",
      caption: "La palette de la saison : sable, écru, terracotta. Le lookbook complet en story.",
      hashtags: ["#lookbook", "#palette", "#minimalstyle"],
    },
    {
      title: "Nos clientes, nos muses",
      caption: "Repostez vos looks avec #AtelierNove, on adore vous voir les porter.",
      hashtags: ["#communauté", "#ugc", "#styleinspo"],
    },
  ],
  yoga: [
    {
      title: "Cours du matin — Vinyasa",
      caption:
        "On démarre la semaine en douceur. Vinyasa lent, focus respiration. 7 h, en studio et en ligne.",
      hashtags: ["#yoga", "#vinyasa", "#bienêtre"],
    },
    {
      title: "Posture de la semaine",
      caption: "Vrksasana, l'arbre. Ancrage, équilibre, patience. On décompose le placement.",
      hashtags: ["#postureyoga", "#équilibre", "#yogapractice"],
    },
    {
      title: "Atelier respiration",
      caption: "Pranayama & cohérence cardiaque, 90 min pour relâcher la pression. Samedi.",
      hashtags: ["#pranayama", "#respiration", "#mindfulness"],
    },
    {
      title: "Nouvelle prof — bienvenue Inès",
      caption: "Inès rejoint le studio pour les cours du soir. Yin & restorative, sa spécialité.",
      hashtags: ["#équipe", "#yinyoga", "#studio"],
    },
    {
      title: "Retraite de printemps",
      caption:
        "Deux jours hors du temps : yoga, marche, silence. Inscriptions ouvertes, lien en bio.",
      hashtags: ["#retraite", "#ressourcement", "#nature"],
    },
    {
      title: "Méditation guidée du soir",
      caption: "10 minutes pour déposer la journée. Disponible en replay pour les membres.",
      hashtags: ["#méditation", "#sommeil", "#calme"],
    },
  ],
}
