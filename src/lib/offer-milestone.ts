import { supabase } from '@/lib/supabase'

// Ogni 10 offerte pubblicate dallo stesso utente, un fulmine.
// Il conteggio include anche le offerte esaurite e ritirate (il ritiro non cancella la riga), quindi non scende mai
// e ogni traguardo (10, 20, 30...) si raggiunge una volta sola.
// Restituisce true se è il momento del fulmine.
export async function reachedOfferMilestone(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('kind', 'offer')
  if (error || count === null) return false
  return count > 0 && count % 10 === 0
}
