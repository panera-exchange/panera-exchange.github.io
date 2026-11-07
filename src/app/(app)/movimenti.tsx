import { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme'
import { fmtDate, money, sumMoney } from '@/lib/format'
import { Amount, Badge, Btn, Card, Checkbox, Grid, ItemIcon, Select, Txt, fmt } from '@/components/ui'
import { TopNav, pageContent } from '@/components/shell'

// Scambio concluso, pubblico: lo vedono tutti gli utenti.
type Trade = {
  id: string; item_id: string; item_name: string; quantity: number; lot_size: number; lot_price: string
  buyer_id: string; buyer: string | null; seller_id: string; seller: string | null; closed_at: string
}
// Voce del proprio conto non legata a uno scambio (es. un deposito) o rimborso di un ordine annullato: la vede solo il titolare.
type Entry = {
  id: number; amount: string; kind: string; memo: string | null; created_at: string
  orders: { quantity: number; lot_size: number; item_id: string; items: { name: string } | null } | null
}
// Ordine in attesa ricalcolato a un cambio del tasso: solo informativo, il saldo non cambia.
type Rescale = {
  id: number; old_lot_price: string; new_lot_price: string; created_at: string
  orders: { quantity: number; lot_size: number; item_id: string; buyer_id: string; items: { name: string } | null } | null
}
type Row = { at: number } & ({ type: 'trade'; trade: Trade } | { type: 'entry'; entry: Entry } | { type: 'rescale'; rescale: Rescale })

const PAGE = 50
const MINE = { bg: 'rgba(242, 183, 5, 0.12)', bar: '#f2b705' }
const ACCOUNT = { bg: 'rgba(58, 108, 192, 0.18)', bar: '#3a6cc0' }

function describe(e: Entry): [string, string] {
  switch (e.kind) {
    case 'grant': return ['Tosi ricevuti', e.memo ?? "Assegnati dall'amministratore"]
    case 'deposit': return ['Deposito di diamanti', e.memo ?? 'Diamanti depositati in banca']
    case 'withdraw': return ['Prelievo di diamanti', e.memo ?? 'Diamanti ritirati dalla banca']
    case 'adjust': return ["Rettifica dell'amministratore", e.memo ?? 'Tosi senza diamanti']
    case 'refund': {
      const o = e.orders
      const what = o ? `${fmt(o.quantity * o.lot_size)} ${o.items?.name ?? o.item_id} · ` : ''
      return ['Ordine annullato', `${what}${e.memo ?? 'Tosi restituiti'}`]
    }
    case 'rescale': return ['Cambio del tasso BCP', e.memo ?? 'Saldo ricalcolato al nuovo tasso']
    default: return ['Movimento del conto', e.memo ?? e.kind]
  }
}

export default function Movimenti() {
  const { session, balance, refreshBalance, isAdmin } = useSession()
  const t = useTheme()
  const me = session?.user.id
  const [mine, setMine] = useState(false)
  // Solo per gli admin: gli scambi di un singolo utente ('all' = tutto il mercato). Esclude "Solo i miei" e viceversa.
  const [subject, setSubject] = useState('all')
  const [users, setUsers] = useState<{ id: string; username: string }[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [rescales, setRescales] = useState<Rescale[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [blocked, setBlocked] = useState('0')
  const [error, setError] = useState('')

  const fetchTrades = useCallback((after?: Trade) => supabase.rpc('market_trades', {
    p_mine: mine, p_before_at: after?.closed_at ?? null, p_before_id: after?.id ?? null, p_limit: PAGE,
    p_profile_id: subject === 'all' ? null : subject,
  }), [mine, subject])

  useFocusEffect(useCallback(() => {
    if (!isAdmin) return
    supabase.from('profiles').select('id, username').order('username').then(({ data }) => setUsers(data ?? []))
  }, [isAdmin]))

  const load = useCallback(async () => {
    refreshBalance()
    const [tr, ledger, pending, resc] = await Promise.all([
      fetchTrades(),
      // Voci senza ordine e rimborsi degli ordini annullati; blocchi e pagamenti sono già negli scambi e in "Bloccati".
      supabase.from('ledger').select('id, amount::text, kind, memo, created_at, orders(quantity, lot_size, item_id, items(name))')
        .or('order_id.is.null,kind.eq.refund')
        .order('created_at', { ascending: false }).limit(100),
      // Tosi bloccati: ordini in attesa in cui sono il compratore.
      supabase.from('orders').select('quantity, lot_price::text').eq('status', 'pending').eq('buyer_id', me ?? ''),
      // La RLS restituisce solo i ricalcoli degli ordini in cui sono compratore o venditore.
      supabase.from('order_rescales').select('id, old_lot_price::text, new_lot_price::text, created_at, orders(quantity, lot_size, item_id, buyer_id, items(name))')
        .order('created_at', { ascending: false }).limit(100),
    ])
    const failure = tr.error ?? ledger.error ?? pending.error ?? resc.error
    if (failure) return setError(failure.message)
    setError('')
    const page = (tr.data ?? []) as Trade[]
    setTrades(page)
    setHasMore(page.length === PAGE)
    setEntries((ledger.data ?? []) as unknown as Entry[])
    setRescales((resc.data ?? []) as unknown as Rescale[])
    setBlocked(sumMoney((pending.data ?? []).map((o) => money(o.lot_price, o.quantity))))
  }, [fetchTrades, refreshBalance, me])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function loadMore() {
    setLoadingMore(true)
    const { data, error } = await fetchTrades(trades.at(-1))
    setLoadingMore(false)
    if (error) return setError(error.message)
    const page = (data ?? []) as Trade[]
    setTrades((old) => [...old, ...page])
    setHasMore(page.length === PAGE)
  }

  // Di chi sono gli scambi evidenziati: l'utente scelto dall'admin, altrimenti io.
  const perspective = subject === 'all' ? me : subject
  const subjectName = users.find((u) => u.id === subject)?.username ?? ''
  // Guardando un altro utente le voci blu (che sono del mio conto) non c'entrano.
  const otherUser = subject !== 'all' && subject !== me

  // Scambi e voci del conto insieme, dal più recente. Finché ci sono altri scambi da caricare,
  // le voci del conto più vecchie dell'ultimo scambio aspettano, per non finire fuori ordine.
  const rows = useMemo(() => {
    const oldest = hasMore && trades.length ? Date.parse(trades[trades.length - 1].closed_at) : -Infinity
    const list: Row[] = [
      ...trades.map((trade) => ({ type: 'trade' as const, at: Date.parse(trade.closed_at), trade })),
      ...(otherUser ? [] : [
        ...entries.map((entry) => ({ type: 'entry' as const, at: Date.parse(entry.created_at), entry })).filter((r) => r.at >= oldest),
        ...rescales.map((rescale) => ({ type: 'rescale' as const, at: Date.parse(rescale.created_at), rescale })).filter((r) => r.at >= oldest),
      ]),
    ]
    return list.sort((a, b) => b.at - a.at)
  }, [trades, entries, rescales, hasMore, otherUser])

  const stats = [
    { key: 'saldo', label: 'Saldo disponibile', value: balance === null ? '...' : fmt(balance), price: true },
    { key: 'bloccati', label: 'Bloccati in acquisti aperti', value: fmt(blocked), price: false },
  ]

  function tradeRow(x: Trade) {
    const total = money(x.lot_price, x.quantity)
    const sold = x.seller_id === perspective
    const bought = x.buyer_id === perspective
    const color = sold ? t.pos : bought ? t.red : t.muted
    const badge = perspective === me
      ? sold ? 'Tua vendita' : 'Tuo acquisto'
      : sold ? `Vendita di ${subjectName}` : `Acquisto di ${subjectName}`
    return (
      <View style={[s.line, (sold || bought) && { backgroundColor: MINE.bg, borderLeftColor: MINE.bar }]}>
        <ItemIcon id={x.item_id} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt>{fmt(x.quantity * x.lot_size)} {x.item_name}</Txt>
          <Txt variant="muted">{x.seller ?? '?'} → {x.buyer ?? '?'} · {fmtDate(x.closed_at)}</Txt>
          {(sold || bought) && <View style={{ marginTop: 4 }}><Badge text={badge} tone={sold ? 'green' : 'gold'} /></View>}
        </View>
        <Amount style={{ color }}>{sold ? '+' : bought ? '-' : ''}{fmt(total)}</Amount>
      </View>
    )
  }

  function entryRow(e: Entry) {
    const [title, detail] = describe(e)
    const positive = !e.amount.startsWith('-')
    return (
      <View style={[s.line, { backgroundColor: ACCOUNT.bg, borderLeftColor: ACCOUNT.bar }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt>{title}</Txt>
          <Txt variant="muted">{detail} · {fmtDate(e.created_at)}</Txt>
        </View>
        <Amount style={{ color: positive ? t.pos : t.red }}>{positive ? '+' : ''}{fmt(e.amount)}</Amount>
      </View>
    )
  }

  // Né + né −: i Tosi trattenuti non sono nel saldo, la riga dice solo come è cambiato l'importo dell'ordine.
  function rescaleRow(r: Rescale) {
    const o = r.orders
    const quantity = o?.quantity ?? 0
    return (
      <View style={[s.line, { backgroundColor: ACCOUNT.bg, borderLeftColor: ACCOUNT.bar }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt>{o?.buyer_id === me ? 'Tosi trattenuti ricalcolati' : 'Importo di vendita ricalcolato'}</Txt>
          <Txt variant="muted">
            {o ? `${fmt(quantity * o.lot_size)} ${o.items?.name ?? o.item_id} · ` : ''}cambio del tasso BCP · {fmtDate(r.created_at)}
          </Txt>
        </View>
        <Amount variant="muted">{fmt(money(r.old_lot_price, quantity))} → {fmt(money(r.new_lot_price, quantity))}</Amount>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pageContent}>
        <TopNav />
        <Grid data={stats} keyOf={(x) => x.key} render={(x) => (
          <Card>
            <Txt variant="muted">{x.label}</Txt>
            <Amount variant={x.price ? 'price' : 'body'} style={{ fontSize: 36, lineHeight: 42 }}>{x.value}</Amount>
          </Card>
        )} />
        {!!error && <Txt variant="error">{error}</Txt>}
        <View style={s.header}>
          <Txt variant="title">Movimenti</Txt>
          <Checkbox label="Solo i miei" value={mine} onChange={(v) => { setMine(v); if (v) setSubject('all') }} />
          {isAdmin && (
            <Select value={subject} onChange={(v) => { setSubject(v); if (v !== 'all') setMine(false) }} width={240}
              options={[{ value: 'all', label: 'Tutti gli utenti' }, ...users.map((u) => ({ value: u.id, label: u.username }))]} />
          )}
        </View>
        <Txt variant="muted">
          {otherUser ? `Gli scambi conclusi di ${subjectName}, come compratore o venditore.`
            : `${mine || subject === me ? 'I tuoi scambi conclusi' : 'Gli scambi conclusi di tutto il mercato'}, con le voci del tuo conto in blu.`}
        </Txt>
        <Card style={{ gap: 6 }}>
          {rows.length === 0 && <Txt variant="muted">Nessun movimento.</Txt>}
          {rows.map((r) => (
            <View key={r.type === 'trade' ? r.trade.id : r.type === 'entry' ? `entry-${r.entry.id}` : `rescale-${r.rescale.id}`}>
              {r.type === 'trade' ? tradeRow(r.trade) : r.type === 'entry' ? entryRow(r.entry) : rescaleRow(r.rescale)}
            </View>
          ))}
        </Card>
        {hasMore && (
          <View style={{ alignItems: 'center' }}>
            <Btn title={loadingMore ? 'Caricamento...' : 'Carica altri'} variant="alt" onPress={loadMore} disabled={loadingMore} />
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  // Barra a sinistra sempre presente (trasparente se la riga non è evidenziata), così il testo resta allineato.
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderLeftWidth: 4, borderLeftColor: 'transparent' },
})
