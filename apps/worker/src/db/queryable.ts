// La plus petite surface de base de données dont un module a besoin pour LIRE.
//
// `pg.Pool` la satisfait telle quelle : ce n'est pas une couche d'abstraction,
// c'est une réduction de dépendance. Elle sert deux choses à la fois :
//   - un module de lecture ne peut pas ouvrir de transaction par accident
//     (règle 18 : les appels HTTP se font hors transaction — le plus sûr est de
//     ne pas donner la transaction) ;
//   - les tests fournissent un faux en une ligne, sans caster un `pg.Pool`
//     incomplet, donc sans mentir au typage.

export interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>
}
