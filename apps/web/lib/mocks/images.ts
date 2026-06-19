// Visuels de démonstration (Pexels, CDN stable, libres de droits).
// On construit des miniatures carrées ~640px pour la grille et le studio.

function sq(id: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=640&h=640`
}

export const IMAGES = {
  coffee: [
    15801079, 5151354, 36851643, 15801074, 34528555, 29516134, 36848520, 8979158, 15801080,
    36851642, 9823550, 15801075,
  ].map(sq),
  food: [
    8696563, 2074104, 15801059, 8743928, 8696565, 35005903, 34052564, 8743912, 6240845, 765548,
    6046746, 8738012,
  ].map(sq),
  fashion: [
    4602025, 8743972, 4458519, 27174550, 18533668, 3750640, 11697691, 5771897, 5693888, 13055401,
    18533669, 18533667,
  ].map(sq),
  yoga: [
    8436449, 8436580, 8436769, 8436400, 6916300, 16148425, 8436463, 8436544, 8436562, 8436398,
    6916301, 8436449,
  ].map(sq),
} as const
