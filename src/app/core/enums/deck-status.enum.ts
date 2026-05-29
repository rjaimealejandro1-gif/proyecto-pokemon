/**
 * DeckStatus — Estados visuales y funcionales de un mazo en el sistema enterprise.
 * Usado en el modal pre-batalla y en el gestor de mazos.
 *
 * SEMÁNTICA DE COLOR APROBADA:
 *   READY        → verde   (listo para combate)
 *   INCOMPLETE   → naranja (faltan cartas)
 *   LOADING      → amarillo (cargando datos desde PokéAPI/Supabase)
 *   SYNCING      → amarillo (sincronizando con la nube)
 *   ERROR        → rojo    (fallo de carga o corrupción)
 */
export enum DeckStatus {
  READY = 'READY',           // 🟢 Exactamente 20 cartas, listo para combatir
  INCOMPLETE = 'INCOMPLETE', // ⚠️ Menos o más de 20 cartas
  LOADING = 'LOADING',       // 🔄 Cargando cartas desde PokéAPI
  SYNCING = 'SYNCING',       // ☁️ Sincronizando con Supabase
  ERROR = 'ERROR'            // 🔴 Error de carga (PokéAPI o Supabase falló)
}
