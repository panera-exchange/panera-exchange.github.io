import { Dialog } from '@/components/dialogs'
import { TopNav, pageContent } from '@/components/shell'
import { Amount, Badge, Btn, Card, ItemIcon, Select, Txt, fmt } from '@/components/ui'
import { compareMoney } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/theme'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'

const HELP = {
  change: {
    label: 'Variazione',
    text: 'Variazione percentuale dell’ultimo prezzo rispetto allo scambio precedente.',
  },
  avg_price: {
    label: 'Media pesata',
    text: 'Prezzo medio per unità di tutti gli scambi conclusi.',
  },
  min_ask: {
    label: 'Vendita da',
    text: 'Il prezzo più basso, per unità, tra le offerte di vendita aperte ora. È il minimo che pagheresti se comprassi adesso.',
  },
  max_bid: {
    label: 'Richiesta fino a',
    text: 'Il prezzo più alto, per unità, tra le richieste di acquisto aperte ora. È il massimo che otterresti se vendessi adesso a chi sta cercando questo item.',
  },
  spread: {
    label: 'Spread',
    text: 'La differenza tra “Vendita da” e “Richiesta fino a”. Se è positivo, chi vende chiede più di quanto chi compra offre. Se è zero o negativo, c’è già un accordo possibile: un’occasione.',
  },
} as const

type HelpKey = keyof typeof HELP
type Sort = 'recent' | 'priceAsc' | 'priceDesc' | 'alphabetical'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: 'Scambi più recenti' },
  { value: 'priceAsc', label: 'Prezzo crescente' },
  { value: 'priceDesc', label: 'Prezzo decrescente' },
  { value: 'alphabetical', label: 'Ordine alfabetico' },
]

const COMPACT_SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: 'Recenti' },
  { value: 'priceAsc', label: 'Prezzo ↑' },
  { value: 'priceDesc', label: 'Prezzo ↓' },
  { value: 'alphabetical', label: 'Nome A–Z' },
]

type MarketStat = {
  item_id: string
  name: string
  last_price: string
  last_trade_at: string
  prev_price: string | null
  avg_price: string
  min_ask: string | null
  max_bid: string | null
  spread: string | null
}

function timeAgo(iso: string, now: number): string {
  const elapsed = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (!Number.isFinite(elapsed)) return 'Data non disponibile'
  if (elapsed < 60) return 'Adesso'
  const minutes = Math.floor(elapsed / 60)
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minuto' : 'minuti'} fa`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ${months === 1 ? 'mese' : 'mesi'} fa`
  const years = Math.max(1, Math.floor(days / 365))
  return `${years} ${years === 1 ? 'anno' : 'anni'} fa`
}

function HelpButton({ kind, onHelp }: { kind: HelpKey; onHelp: (kind: HelpKey) => void }) {
  const t = useTheme()
  return (
    <Pressable onPress={() => onHelp(kind)} accessibilityRole="button"
      accessibilityLabel={`Informazioni su ${HELP[kind].label}`} hitSlop={8}
      style={[s.helpButton, { borderColor: t.line, backgroundColor: t.soft }]}>
      <Txt style={s.helpMark}>?</Txt>
    </Pressable>
  )
}

function PriceChange({ current, previous, onHelp }: {
  current: string; previous: string | null; onHelp: (kind: HelpKey) => void
}) {
  const t = useTheme()
  if (previous === null || compareMoney(previous, '0') <= 0) return null
  const direction = compareMoney(current, previous)
  const percent = (Number(current) / Number(previous) - 1) * 100
  if (!Number.isFinite(percent)) return null
  const text = `${direction > 0 ? '▲ +' : direction < 0 ? '▼ −' : '▬ '}${Math.abs(percent).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`
  return <View style={s.priceChange}>
    <Txt style={{ color: direction > 0 ? t.pos : direction < 0 ? t.red : t.muted, fontSize: 20 }}>{text}</Txt>
    <HelpButton kind="change" onHelp={onHelp} />
  </View>
}

function Metric({ kind, value, opportunity, onHelp }: {
  kind: HelpKey; value: string; opportunity?: boolean; onHelp: (kind: HelpKey) => void
}) {
  return (
    <View style={s.metric}>
      <View style={s.metricHeading}>
        <Txt variant="muted" style={[s.metricLabel, { flexShrink: 1 }]}>{HELP[kind].label}</Txt>
        <HelpButton kind={kind} onHelp={onHelp} />
      </View>
      <Txt style={s.metricValue}>{value}</Txt>
      {opportunity && <Badge text="Occasione" tone="green" />}
    </View>
  )
}

function StatCard({ row, wide, now, onHelp }: {
  row: MarketStat; wide: boolean; now: number; onHelp: (kind: HelpKey) => void
}) {
  const t = useTheme()
  const opportunity = row.spread !== null && compareMoney(row.spread, '0') <= 0
  return (
    <Card style={s.card}>
      <View style={s.heading}>
        <ItemIcon id={row.item_id} size={44} />
        <Txt variant="title" style={s.name} numberOfLines={2}>{row.name}</Txt>
        <PriceChange current={row.last_price} previous={row.prev_price} onHelp={onHelp} />
      </View>
      <View style={[s.details, wide ? s.detailsWide : s.detailsNarrow]}>
        <View style={[s.mainPrice, wide && s.mainPriceWide]}>
          <Amount variant="price" style={s.price}>{fmt(row.last_price)}</Amount>
          <Txt variant="muted" style={s.unit}>per unità</Txt>
          <Txt variant="muted" style={s.time}>Ultimo scambio · {timeAgo(row.last_trade_at, now)}</Txt>
        </View>
        <View style={[s.metrics, wide ? s.metricsWide : s.metricsNarrow, { borderColor: t.line }]}>
          <Metric kind="avg_price" value={fmt(row.avg_price)} onHelp={onHelp} />
          <Metric kind="min_ask" value={row.min_ask === null ? '−' : fmt(row.min_ask)} onHelp={onHelp} />
          <Metric kind="max_bid" value={row.max_bid === null ? '−' : fmt(row.max_bid)} onHelp={onHelp} />
          <Metric kind="spread" value={row.spread === null ? '−' : fmt(row.spread)}
            opportunity={opportunity} onHelp={onHelp} />
        </View>
      </View>
    </Card>
  )
}

export default function Andamento() {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const wide = width >= 780
  const sortWidth = Math.min(250, Math.max(130, Math.floor(width * 0.45)))
  const [rows, setRows] = useState<MarketStat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(0)
  const [help, setHelp] = useState<HelpKey | null>(null)
  const [sort, setSort] = useState<Sort>('recent')

  const sortedRows = useMemo(() => {
    if (sort === 'recent') return rows
    const byName = (a: MarketStat, b: MarketStat) =>
      a.name.localeCompare(b.name, 'it-IT', { sensitivity: 'base' }) || a.item_id.localeCompare(b.item_id)
    return [...rows].sort((a, b) =>
      sort === 'alphabetical' ? byName(a, b)
      : (sort === 'priceAsc' ? compareMoney(a.last_price, b.last_price) : compareMoney(b.last_price, a.last_price)) || byName(a, b))
  }, [rows, sort])

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('market_stats')
      .select('item_id,name,last_price::text,last_trade_at,prev_price::text,avg_price::text,min_ask::text,max_bid::text,spread::text')
      .order('last_trade_at', { ascending: false })
    setLoading(false)
    setRefreshing(false)
    setNow(Date.now())
    if (queryError) setError(queryError.message)
    else {
      setError('')
      setRows((data ?? []) as unknown as MarketStat[])
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList data={sortedRows} keyExtractor={(row) => row.item_id}
        renderItem={({ item }) => <StatCard row={item} wide={wide} now={now} onHelp={setHelp} />}
        contentContainerStyle={pageContent} showsVerticalScrollIndicator={false}
        refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }}
        ListHeaderComponent={<View style={{ gap: 14 }}>
          <TopNav />
          <View style={s.header}>
            <View style={s.headerRow}>
              <View style={s.headerText}>
                <Txt variant="title">Andamento</Txt>
                <Txt variant="muted">Prezzi e scambi conclusi su PanEx</Txt>
              </View>
              <View style={s.sortColumn}>
                <Txt variant="muted" style={s.sortLabel}>Ordina per</Txt>
                <Select value={sort} options={width < 600 ? COMPACT_SORTS : SORTS}
                  onChange={setSort} width={sortWidth} />
              </View>
            </View>
            {!!error && <Txt variant="error">{error}</Txt>}
          </View>
        </View>}
        ListEmptyComponent={loading
          ? <ActivityIndicator color={t.green} />
          : !error ? <Txt variant="muted">Nessun item ha ancora uno scambio concluso.</Txt> : null}
      />
      {help && <Dialog onClose={() => setHelp(null)} scrollable>
        <Txt variant="title">{HELP[help].label}</Txt>
        <Txt>{HELP[help].text}</Txt>
        <View style={{ alignSelf: 'flex-end', marginTop: 8 }}>
          <Btn title="Chiudi" variant="alt" onPress={() => setHelp(null)} />
        </View>
      </Dialog>}
    </View>
  )
}

const s = StyleSheet.create({
  header: { gap: 4, marginBottom: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
  sortColumn: { alignItems: 'flex-end', gap: 4 },
  sortLabel: { fontSize: 18, lineHeight: 21 },
  card: { gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceChange: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flex: 1, minWidth: 0 },
  details: { gap: 16 },
  detailsWide: { flexDirection: 'row', alignItems: 'center' },
  detailsNarrow: { alignItems: 'stretch' },
  mainPrice: { alignItems: 'center', justifyContent: 'center' },
  mainPriceWide: { flex: 1, minWidth: 200 },
  price: { fontSize: 38, lineHeight: 42, textAlign: 'center' },
  unit: { fontSize: 18, lineHeight: 21 },
  time: { fontSize: 18, lineHeight: 21, textAlign: 'center', marginTop: 5 },
  metrics: { borderTopWidth: 2, paddingTop: 12, gap: 8 },
  metricsWide: { flex: 2, flexDirection: 'row', borderTopWidth: 0, borderLeftWidth: 2, paddingTop: 0, paddingLeft: 16 },
  metricsNarrow: { flexDirection: 'row', flexWrap: 'wrap' },
  metric: { flex: 1, minWidth: 110, gap: 2 },
  metricHeading: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24 },
  metricLabel: { fontSize: 17, lineHeight: 20 },
  metricValue: { fontSize: 24, lineHeight: 28 },
  helpButton: { width: 20, height: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  helpMark: { fontSize: 16, lineHeight: 17 },
})
