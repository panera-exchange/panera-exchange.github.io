import { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme'
import { fmtDate, money, sumMoney } from '@/lib/format'
import { Amount, Badge, Btn, Card, Checkbox, Grid, ItemIcon, Txt, fmt } from '@/components/ui'

// Scambio concluso, pubblico: lo vedono tutti gli utenti.
type Trade = {
  id: string; item_id: string; item_name: string; quantity: number; unit_price: string
  buyer_id: string; buyer: string | null; seller_id: string; seller: string | null; closed_at: string
}
// Voce del proprio conto non legata a uno scambio (es. Tosi assegnati dall'admin): la vede solo il titolare.
type Entry = { id: number; amount: string; kind: string; memo: string | null; created_at: string }
type Row = { at: number } & ({ type: 'trade'; trade: Trade } | { type: 'entry'; entry: Entry })

const PAGE = 50
const MINE = { bg: 'rgba(242, 183, 5, 0.12)', bar: '#f2b705' }
const ACCOUNT = { bg: 'rgba(58, 108, 192, 0.18)', bar: '#3a6cc0' }

function describe(e: Entry): [string, string] {
  switch (e.kind) {
    case 'grant': return ['Tosi ricevuti', e.memo ?? "Assegnati dall'amministratore"]
    default: return ['Movimento del conto', e.memo ?? e.kind]
  }
}

export default function Movimenti() {
  const { session, balance, refreshBalance } = useSession()
  const t = useTheme()
  const me = session?.user.id
  const [mine, setMine] = useState(false)
  const [trades, setTrades] = useState<Trade[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [blocked, setBlocked] = useState('0')
  const [error, setError] = useState('')

  const fetchTrades = useCallback((after?: Trade) => supabase.rpc('market_trades', {
    p_mine: mine, p_before_at: after?.closed_at ?? null, p_before_id: after?.id ?? null, p_limit: PAGE,
  }), [mine])

  const load = useCallback(async () => {
    refreshBalance()
    const [tr, ledger, pending] = await Promise.all([
      fetchTrades(),
      supabase.from('ledger').select('id, amount::text, kind, memo, created_at').is('order_id', null)
        .order('created_at', { ascending: false }).limit(100),
      // Tosi bloccati: ordini in attesa in cui sono il compratore.
      supabase.from('orders').select('quantity, unit_price::text').eq('status', 'pending').eq('buyer_id', me ?? ''),
    ])
    const failure = tr.error ?? ledger.error ?? pending.error
    if (failure) return setError(failure.message)
    setError('')
    const page = (tr.data ?? []) as Trade[]
    setTrades(page)
    setHasMore(page.length === PAGE)
    setEntries((ledger.data ?? []) as Entry[])
    setBlocked(sumMoney((pending.data ?? []).map((o) => money(o.unit_price, o.quantity))))
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

  // Scambi e voci del conto insieme, dal più recente. Finché ci sono altri scambi da caricare,
  // le voci del conto più vecchie dell'ultimo scambio aspettano, per non finire fuori ordine.
  const rows = useMemo(() => {
    const oldest = hasMore && trades.length ? Date.parse(trades[trades.length - 1].closed_at) : -Infinity
    const list: Row[] = [
      ...trades.map((trade) => ({ type: 'trade' as const, at: Date.parse(trade.closed_at), trade })),
      ...entries.map((entry) => ({ type: 'entry' as const, at: Date.parse(entry.created_at), entry })).filter((r) => r.at >= oldest),
    ]
    return list.sort((a, b) => b.at - a.at)
  }, [trades, entries, hasMore])

  const stats = [
    { key: 'saldo', label: 'Saldo disponibile', value: balance === null ? '...' : fmt(balance), price: true },
    { key: 'bloccati', label: 'Bloccati in acquisti aperti', value: fmt(blocked), price: false },
  ]

  function tradeRow(x: Trade) {
    const total = money(x.unit_price, x.quantity)
    const sold = x.seller_id === me
    const bought = x.buyer_id === me
    const color = sold ? t.pos : bought ? t.red : t.muted
    return (
      <View style={[s.line, (sold || bought) && { backgroundColor: MINE.bg, borderLeftColor: MINE.bar }]}>
        <ItemIcon id={x.item_id} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt>{fmt(x.quantity)} {x.item_name}</Txt>
          <Txt variant="muted">{x.seller ?? '?'} → {x.buyer ?? '?'} · {fmtDate(x.closed_at)}</Txt>
          {(sold || bought) && <View style={{ marginTop: 4 }}><Badge text={sold ? 'Tua vendita' : 'Tuo acquisto'} tone={sold ? 'green' : 'gold'} /></View>}
        </View>
        <Amount style={{ color }} iconSize={36}>{sold ? '+' : bought ? '-' : ''}{fmt(total)}</Amount>
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
        <Amount style={{ color: positive ? t.pos : t.red }} iconSize={36}>{positive ? '+' : ''}{fmt(e.amount)}</Amount>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, gap: 14 }}>
        <Grid data={stats} keyOf={(x) => x.key} render={(x) => (
          <Card>
            <Txt variant="muted">{x.label}</Txt>
            <Amount variant={x.price ? 'price' : 'body'} style={{ fontSize: 36, lineHeight: 42 }} iconSize={50}>{x.value}</Amount>
          </Card>
        )} />
        {!!error && <Txt variant="error">{error}</Txt>}
        <View style={s.header}>
          <Txt variant="title">Movimenti</Txt>
          <Checkbox label="Solo i miei" value={mine} onChange={setMine} />
        </View>
        <Txt variant="muted">
          {mine ? 'I tuoi scambi conclusi' : 'Gli scambi conclusi di tutto il mercato'}, con le voci del tuo conto in blu.
        </Txt>
        <Card style={{ gap: 6 }}>
          {rows.length === 0 && <Txt variant="muted">Nessun movimento.</Txt>}
          {rows.map((r) => (
            <View key={r.type === 'trade' ? r.trade.id : `entry-${r.entry.id}`}>
              {r.type === 'trade' ? tradeRow(r.trade) : entryRow(r.entry)}
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
