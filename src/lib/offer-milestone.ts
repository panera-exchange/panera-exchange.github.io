import { supabase } from '@/lib/supabase'

// Ogni 10 offerte pubblicate dallo stesso utente, un fulmine.
// Contiamo tutte le offerte che l'utente ha creato e ricordiamo sul dispositivo l'ultimo traguardo
// già festeggiato (10, 20, 30...), così il fulmine non si ripete e ritirare/ripubblicare non lo fa ripartire.
// Restituisce true se è il momento del fulmine.
export async function reachedOfferMilestone(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('kind', 'offer')
  if (error || count === null) return false

  const milestone = Math.floor(count / 10) // 0 sotto le 10 offerte, 1 da 10 a 19, 2 da 20 a 29...
  const key = `panex_lightning_${userId}`
  let celebrated = 0
  try { celebrated = Number(localStorage.getItem(key)) || 0 } catch { /* memoria del dispositivo non disponibile */ }
  if (milestone <= celebrated) return false

  try { localStorage.setItem(key, String(milestone)) } catch { /* memoria del dispositivo non disponibile */ }
  return true
}