import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { useToast } from '@/lib/toast'

type Counts = { toDeliver: number; toReceive: number }

// "subscribe" avvisa a ogni novità sugli ordini, così la pagina Ordini sa quando ricaricarsi.
type Ctx = { todo: number; refresh: () => void; subscribe: (listener: () => void) => () => void }
const OrderAlertsContext = createContext<Ctx>({ todo: 0, refresh: () => {}, subscribe: () => () => {} })

// La RLS restituisce solo gli ordini in cui sono compratore o venditore.
async function fetchCounts(uid: string): Promise<Counts | null> {
  const { data, error } = await supabase.from('orders').select('seller_id, delivered_at').eq('status', 'pending')
  if (error || !data) return null
  return {
    toDeliver: data.filter((o) => o.seller_id === uid && !o.delivered_at).length,
    toReceive: data.filter((o) => o.seller_id !== uid && !!o.delivered_at).length,
  }
}

// Ordini in attesa che aspettano me: da consegnare (vendo) o da ritirare (compro e sono già consegnati).
// Arrivano in tempo reale da Supabase Realtime e, per sicurezza, si ricontrollano ogni minuto.
// Quando ne compare uno nuovo c'è un avviso.
export function OrderAlertsProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  const toast = useToast()
  const uid = session?.user.id
  // I conteggi sono legati all'utente che li ha ricevuti: cambiando account non restano quelli vecchi.
  const [state, setState] = useState<{ uid: string; counts: Counts } | null>(null)
  const last = useRef<{ uid: string; counts: Counts } | null>(null)
  const listeners = useRef(new Set<() => void>())
  const counts = state && state.uid === uid ? state.counts : null

  // Confronta i conteggi nuovi con quelli di prima: avviso se è arrivato qualcosa, e pagina Ordini da ricaricare.
  const apply = useCallback((userId: string, next: Counts, changed: boolean) => {
    const before = last.current?.uid === userId ? last.current.counts : null
    if (before && next.toReceive > before.toReceive) toast('Consegna arrivata: ritira gli item in gioco e premi Ricevuto in Ordini.')
    else if (before && next.toDeliver > before.toDeliver) toast('Nuovo ordine: consegna gli item in gioco e premi Consegnato in Ordini.')
    last.current = { uid: userId, counts: next }
    setState({ uid: userId, counts: next })
    if (changed || (before && (before.toDeliver !== next.toDeliver || before.toReceive !== next.toReceive))) {
      listeners.current.forEach((listener) => listener())
    }
  }, [toast])

  const refresh = useCallback(() => {
    if (uid) fetchCounts(uid).then((next) => { if (next) apply(uid, next, false) })
  }, [uid, apply])

  const subscribe = useCallback((listener: () => void) => {
    listeners.current.add(listener)
    return () => { listeners.current.delete(listener) }
  }, [])

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    const check = (changed: boolean) => fetchCounts(uid).then((next) => { if (!cancelled && next) apply(uid, next, changed) })
    check(false)
    const timer = setInterval(() => check(false), 60_000)
    const channel = supabase.channel(`orders-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => check(true))
      .subscribe()
    return () => { cancelled = true; clearInterval(timer); supabase.removeChannel(channel) }
  }, [uid, apply])

  const value = {
    todo: counts ? counts.toDeliver + counts.toReceive : 0,
    refresh,
    subscribe,
  }
  return <OrderAlertsContext.Provider value={value}>{children}</OrderAlertsContext.Provider>
}

export const useOrderAlerts = () => useContext(OrderAlertsContext)
