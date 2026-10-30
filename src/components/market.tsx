import { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { useToast } from '@/lib/toast'
import { fonts, useTheme } from '@/theme'
import { Amount, Badge, Btn, Card, Checkbox, ItemIcon, Select, Txt, fmt } from '@/components/ui'
import { TopNav, pageContent } from '@/components/shell'
import { ConfirmDialog, Dialog, ListingDialog } from '@/components/dialogs'
import { useLightning } from '@/components/lightning'
import { compareMoney, lots, money, perUnit, stacks, subtractMoney } from '@/lib/format'
import { CATEGORIES, categoryLabel, type Category } from '@/lib/categories'
import { reachedOfferMilestone } from '@/lib/offer-milestone'

type Kind = 'offer' | 'request'
type Sort = 'new' | 'asc' | 'desc'
// quantity conta i lotti, lot_price è il prezzo di un lotto da lot_size pezzi.
type Row = {
  id: string; owner_id: string; quantity: number; lot_size: number; lot_price: string; note: string | null
  status: 'open' | 'closed'; created_at: string; item_id: string
  items: { name: string; stack_size: number; category: Category } | null; profiles: { username: string } | null
}

const SORTS: { value: Sort; label: string }[] = [
  { value: 'new', label: 'Più recenti' },
  { value: 'asc', label: 'Prezzo crescente' },
  { value: 'desc', label: 'Prezzo decrescente' },
]

const CATEGORY_FILTER: { value: Category | 'all'; label: string }[] = [{ value: 'all', label: 'Tutte le categorie' }, ...CATEGORIES]

function availability(r: Row, isReq: boolean): string {
  if (r.lot_size === 1) return `${fmt(r.quantity)} ${isReq ? 'richiesti' : 'disponibili'}`
  if (r.quantity === 1) return `1 lotto ${isReq ? 'richiesto' : 'disponibile'}`
  return `${lots(r.quantity)} ${isReq ? 'richiesti' : 'disponibili'}`
}

// "128 Cookie (2 stack)": i pezzi da scambiare in gioco.
function piecesText(r: Row, quantity: number): string {
  const pieces = quantity * r.lot_size
  const hint = stacks(pieces, r.items?.stack_size ?? 64)
  return `${fmt(pieces)} ${r.items?.name ?? r.item_id}${hint ? ` (${hint})` : ''}`
}

// Elenco di annunci: serve sia per le Offerte (si compra) sia per le Richieste (si vende).
export function Market({ kind }: { kind: Kind }) {
  const { session } = useSession()
  const toast = useToast()
  const t = useTheme()
  const { width } = useWindowDimensions()
  const wide = width >= 700
  const me = session?.user.id
  const isReq = kind === 'request'
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('new')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [mine, setMine] = useState(false)
  const [notMine, setNotMine] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [withdrawing, setWithdrawing] = useState<Row | null>(null)
  const [wdBusy, setWdBusy] = useState(false)
  const [wdErr, setWdErr] = useState('')
  const strike = useLightning()

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('id, owner_id, quantity, lot_size, lot_price::text, note, status, created_at, item_id, items(name, stack_size, category), profiles(username)')
      .eq('kind', kind)
      // Anche i propri annunci esauriti, che si possono rifornire.
      .or(me ? `status.eq.open,and(status.eq.closed,owner_id.eq.${me})` : 'status.eq.open')
    if (error) setError(error.message)
    else {
      setError('')
      setRows((data ?? []) as unknown as Row[])
    }
  }, [kind, me])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = rows.filter((r) =>
      (mine ? r.owner_id === me : r.status === 'open' && (!notMine || r.owner_id !== me)) &&
      (category === 'all' || r.items?.category === category) &&
      `${r.items?.name ?? r.item_id} ${r.profiles?.username ?? ''}`.toLowerCase().includes(needle))
    // Il prezzo si confronta per pezzo (a/x contro b/y come a·y contro b·x, senza arrotondare); gli esauriti in fondo.
    const byPrice = (a: Row, b: Row) => compareMoney(money(a.lot_price, b.lot_size), money(b.lot_price, a.lot_size))
    return list.sort((a, b) =>
      Number(a.status === 'closed') - Number(b.status === 'closed')
      || (sort === 'asc' ? byPrice(a, b) : sort === 'desc' ? byPrice(b, a) : b.created_at.localeCompare(a.created_at)))
  }, [rows, q, sort, category, mine, notMine, me])

  async function withdraw() {
    if (!withdrawing) return
    setWdBusy(true)
    setWdErr('')
    const { error } = await supabase.rpc('withdraw_listing', { p_listing_id: withdrawing.id })
    setWdBusy(false)
    if (error) return setWdErr(error.message)
    setWithdrawing(null)
    toast('Annuncio ritirato.')
    load()
  }

  function card(r: Row) {
    const name = r.items?.name ?? r.item_id
    const isLot = r.lot_size > 1
    const sold = r.status === 'closed'
    const unit = perUnit(r.lot_price, r.lot_size)
    const hint = stacks(r.lot_size, r.items?.stack_size ?? 64)
    return (
      <Card style={[s.listing, wide && s.listingWide]}>
        <View style={s.listingDetails}>
          <View style={s.row}>
            <ItemIcon id={r.item_id} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="title">{isLot ? `${fmt(r.lot_size)} × ${name}` : name}</Txt>
              <Txt variant="muted">{sold ? (isReq ? 'Richiesta completata' : 'Tutto venduto') : availability(r, isReq)}{hint ? ` · lotti da ${hint}` : ''}</Txt>
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            <Amount variant="price" after={isLot ? '/ lotto' : '/ unità'}>{fmt(r.lot_price)}</Amount>
            {isLot && (
              <Amount variant="muted" after="/ unità">
                {compareMoney(money(unit, r.lot_size), r.lot_price) === 0 ? '' : '≈ '}{fmt(unit)}
              </Amount>
            )}
          </View>
          {!!r.note && <Txt variant="muted">Note: {r.note}</Txt>}
          <Txt variant="muted">{isReq ? 'richiesta di ' : 'di '}{r.profiles?.username ?? '?'} · {new Date(r.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Txt>
          <View style={[s.row, { marginTop: 8 }]}>
            {!!r.items && <Badge text={categoryLabel(r.items.category)} tone="gray" />}
            {r.owner_id === me && <Badge text={isReq ? 'Tua richiesta' : 'Tua offerta'} />}
            {sold && <Badge text="Esaurita" tone="gray" />}
          </View>
        </View>
        <View style={[s.listingActions, wide && s.listingActionsWide]}>
          {r.owner_id === me ? (
            <>
              <View style={wide ? s.actionButtonWide : s.actionButton}>
                {sold
                  ? <Btn title="Rifornisci" full onPress={() => setEditing(r)} />
                  : <Btn title="Modifica" variant="alt" full onPress={() => setEditing(r)} />}
              </View>
              <View style={wide ? s.actionButtonWide : s.actionButton}>
                <Btn title="Ritira" variant="danger" full onPress={() => { setWdErr(''); setWithdrawing(r) }} />
              </View>
            </>
          ) : (
            <View style={wide ? s.actionButtonWide : s.actionButton}>
              <Btn title={isReq ? 'Vendi' : 'Compra'} full onPress={() => setSelected(r)} />
            </View>
          )}
        </View>
      </Card>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pageContent}>
        <TopNav />
        <Txt variant="muted">
          {isReq ? 'Item che altri cercano: vendi quello che hai.' : 'Item in vendita: scegli cosa comprare.'}
        </Txt>
        <View style={[s.row, { gap: 12 }]}>
          <Btn title={isReq ? '+ Nuova richiesta' : '+ Nuova offerta'} onPress={() => setCreating(true)} />
          <Checkbox label="Solo le mie" value={mine} onChange={(v) => { setMine(v); if (v) setNotMine(false) }} />
          <Checkbox label="Eccetto le mie" value={notMine} onChange={(v) => { setNotMine(v); if (v) setMine(false) }} />
        </View>
        <View style={[s.row, { alignItems: 'flex-start' }]}>
          <TextInput value={q} onChangeText={setQ} placeholder="Cerca item o utente" placeholderTextColor={t.muted}
            style={[s.input, { flex: 1, minWidth: 200, borderColor: t.line, backgroundColor: t.panel, color: t.ink }]} />
          <Select value={category} options={CATEGORY_FILTER} onChange={setCategory} width={260} />
          <Select value={sort} options={SORTS} onChange={setSort} />
        </View>
        {!!error && <Txt variant="error">{error}</Txt>}
        {visible.length === 0
          ? <Txt variant="muted">Nessun annuncio trovato.</Txt>
          : <View style={s.list}>{visible.map((r) => <View key={r.id}>{card(r)}</View>)}</View>}
      </ScrollView>
      {selected && (
        <OrderDialog row={selected} isReq={isReq} onClose={() => setSelected(null)}
          onDone={(message) => { setSelected(null); toast(message); load() }} />
      )}
      {creating && (
        <ListingDialog kind={kind} onClose={() => setCreating(false)}
          onDone={async (message) => {
            setCreating(false); setMine(true); setNotMine(false); toast(message); load()
            if (kind === 'offer' && me && await reachedOfferMilestone(me)) strike()
          }} />
      )}
      {editing && (
        <ListingDialog kind={kind} onClose={() => setEditing(null)}
          listing={{
            id: editing.id, item_id: editing.item_id, name: editing.items?.name ?? editing.item_id, stack_size: editing.items?.stack_size ?? 64,
            quantity: editing.quantity, lot_size: editing.lot_size, lot_price: editing.lot_price, note: editing.note,
          }}
          onDone={(message) => { setEditing(null); toast(message); load() }} />
      )}
      {withdrawing && (
        <ConfirmDialog title="Ritirare l'annuncio?" danger confirmLabel="Ritira" busy={wdBusy} error={wdErr}
          text={`${withdrawing.items?.name ?? withdrawing.item_id} sparirà dalla bacheca. Gli ordini già in corso restano validi.`}
          onConfirm={withdraw} onClose={() => setWithdrawing(null)} />
      )}
    </View>
  )
}

function OrderDialog({ row, isReq, onClose, onDone }: {
  row: Row; isReq: boolean; onClose: () => void; onDone: (message: string) => void
}) {
  const t = useTheme()
  const { balance, refreshBalance } = useSession()
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const name = row.items?.name ?? row.item_id
  const owner = row.profiles?.username ?? '?'
  const n = /^\d+$/.test(qty.trim()) ? Number(qty) : 0
  const validQty = Number.isSafeInteger(n) && n >= 1 && n <= row.quantity
  const isLot = row.lot_size > 1
  const total = money(row.lot_price, validQty ? n : 0)
  let problem = ''
  if (!validQty) problem = isLot ? `Scegli un numero di lotti tra 1 e ${fmt(row.quantity)}.` : `Scegli una quantità intera tra 1 e ${fmt(row.quantity)}.`
  else if (!isReq && compareMoney(total, balance ?? '0') > 0) problem = 'Tosi insufficienti per questa quantità.'

  async function confirm() {
    setBusy(true)
    setErr('')
    const { error } = await supabase.rpc('create_order', { p_listing_id: row.id, p_quantity: n })
    setBusy(false)
    if (error) return setErr(error.message)
    await refreshBalance()
    onDone(isReq
      ? `Consegna ${piecesText(row, n)} a ${owner} in gioco e premi Consegnato in Ordini. Quando conferma, ricevi ${fmt(total)} Tosi.`
      : `${fmt(total)} Tosi bloccati. Quando ${owner} consegna in gioco riceverai un avviso: ritira gli item e premi Ricevuto.`)
  }

  return (
    <Dialog onClose={onClose}>
      <Txt variant="title">{isReq ? 'Vendi' : 'Compra'} {name}</Txt>
      <Amount variant="muted" after={`${isLot ? `/ lotto da ${fmt(row.lot_size)}` : '/ unità'} · ${availability(row, isReq)}`}>
        {isReq ? 'Richiesta di' : 'Venditore:'} {owner} · {fmt(row.lot_price)}
      </Amount>
      <View style={s.row}>
        <Btn title="−" variant="alt" onPress={() => setQty(String(Math.max(1, n - 1)))} />
        <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad"
          style={[s.input, { width: 84, textAlign: 'center', borderColor: t.line, backgroundColor: t.panel, color: t.ink }]} />
        <Btn title="+" variant="alt" onPress={() => setQty(String(Math.min(row.quantity, n + 1)))} />
        <Btn title="Max" variant="alt" onPress={() => setQty(String(row.quantity))} />
      </View>
      {isLot && validQty && <Txt>{lots(n)} = {piecesText(row, n)}</Txt>}
      <Amount variant="price">Totale: {fmt(total)}</Amount>
      {isReq
        ? <Amount variant="muted" after={`quando ${owner} conferma.`}>Riceverai {fmt(total)}</Amount>
        : <Amount variant="muted">{`Saldo dopo l'acquisto: ${fmt(subtractMoney(balance ?? '0', total))}`}</Amount>}
      {!!(problem || err) && <Txt variant="error">{problem || err}</Txt>}
      <View style={s.row}>
        <Btn title="Annulla" variant="alt" onPress={onClose} />
        <Btn title={isReq ? 'Conferma vendita' : 'Conferma acquisto'} onPress={confirm} disabled={!!problem || busy} />
      </View>
    </Dialog>
  )
}

const s = StyleSheet.create({
  input: { borderWidth: 3, paddingHorizontal: 8, paddingVertical: 4, fontFamily: fonts.body, fontSize: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  list: { gap: 16 },
  listing: { gap: 12 },
  listingWide: { flexDirection: 'row', alignItems: 'center' },
  listingDetails: { flex: 1, minWidth: 0 },
  listingActions: { flexDirection: 'row', gap: 8 },
  listingActionsWide: { width: 140, flexDirection: 'column' },
  actionButton: { flex: 1 },
  actionButtonWide: { width: '100%' },
})
