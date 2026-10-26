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
import { compareMoney, money, subtractMoney } from '@/lib/format'

type Kind = 'offer' | 'request'
type Sort = 'new' | 'asc' | 'desc'
type Row = {
  id: string; owner_id: string; quantity: number; unit_price: string; note: string | null
  created_at: string; item_id: string; items: { name: string } | null; profiles: { username: string } | null
}

const SORTS: { value: Sort; label: string }[] = [
  { value: 'new', label: 'Più recenti' },
  { value: 'asc', label: 'Prezzo crescente' },
  { value: 'desc', label: 'Prezzo decrescente' },
]

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
  const [mine, setMine] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [withdrawing, setWithdrawing] = useState<Row | null>(null)
  const [wdBusy, setWdBusy] = useState(false)
  const [wdErr, setWdErr] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('id, owner_id, quantity, unit_price::text, note, created_at, item_id, items(name), profiles(username)')
      .eq('kind', kind)
      .eq('status', 'open')
    if (error) setError(error.message)
    else {
      setError('')
      setRows((data ?? []) as unknown as Row[])
    }
  }, [kind])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = rows.filter((r) =>
      (!mine || r.owner_id === me) &&
      `${r.items?.name ?? r.item_id} ${r.profiles?.username ?? ''}`.toLowerCase().includes(needle))
    return list.sort((a, b) =>
      sort === 'asc' ? compareMoney(a.unit_price, b.unit_price)
      : sort === 'desc' ? compareMoney(b.unit_price, a.unit_price)
      : b.created_at.localeCompare(a.created_at))
  }, [rows, q, sort, mine, me])

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
    return (
      <Card style={[s.listing, wide && s.listingWide]}>
        <View style={s.listingDetails}>
          <View style={s.row}>
            <ItemIcon id={r.item_id} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="title">{name}</Txt>
              <Txt variant="muted">{fmt(r.quantity)} {isReq ? 'richiesti' : 'disponibili'}</Txt>
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            <Amount variant="price" after="/ unità">{fmt(r.unit_price)}</Amount>
          </View>
          {!!r.note && <Txt variant="muted">Note: {r.note}</Txt>}
          <Txt variant="muted">{isReq ? 'richiesta di ' : 'di '}{r.profiles?.username ?? '?'} · {new Date(r.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Txt>
          {r.owner_id === me && <View style={{ marginTop: 8 }}><Badge text={isReq ? 'Tua richiesta' : 'Tua offerta'} /></View>}
        </View>
        <View style={[s.listingActions, wide && s.listingActionsWide]}>
          {r.owner_id === me ? (
            <>
              <View style={wide ? s.actionButtonWide : s.actionButton}>
                <Btn title="Modifica" variant="alt" full onPress={() => setEditing(r)} />
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
          <Checkbox label="Solo le mie" value={mine} onChange={setMine} />
        </View>
        <View style={[s.row, { alignItems: 'flex-start' }]}>
          <TextInput value={q} onChangeText={setQ} placeholder="Cerca item o utente" placeholderTextColor={t.muted}
            style={[s.input, { flex: 1, minWidth: 200, borderColor: t.line, backgroundColor: t.panel, color: t.ink }]} />
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
          onDone={(message) => { setCreating(false); setMine(true); toast(message); load() }} />
      )}
      {editing && (
        <ListingDialog kind={kind} onClose={() => setEditing(null)}
          listing={{ id: editing.id, name: editing.items?.name ?? editing.item_id, quantity: editing.quantity, unit_price: editing.unit_price, note: editing.note }}
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
  const total = money(row.unit_price, validQty ? n : 0)
  let problem = ''
  if (!validQty) problem = `Scegli una quantità intera tra 1 e ${fmt(row.quantity)}.`
  else if (!isReq && compareMoney(total, balance ?? '0') > 0) problem = 'Tosi insufficienti per questa quantità.'

  async function confirm() {
    setBusy(true)
    setErr('')
    const { error } = await supabase.rpc('create_order', { p_listing_id: row.id, p_quantity: n })
    setBusy(false)
    if (error) return setErr(error.message)
    await refreshBalance()
    onDone(isReq
      ? `Consegna ${n} ${name} a ${owner} in gioco. Quando conferma, ricevi ${fmt(total)} Tosi.`
      : `${fmt(total)} Tosi bloccati. Ritira ${n} ${name} da ${owner} in gioco, poi premi Ricevuto.`)
  }

  return (
    <Dialog onClose={onClose}>
      <Txt variant="title">{isReq ? 'Vendi' : 'Compra'} {name}</Txt>
      <Amount variant="muted" after={`/ unità · ${fmt(row.quantity)} ${isReq ? 'richiesti' : 'disponibili'}`}>
        {isReq ? 'Richiesta di' : 'Venditore:'} {owner} · {fmt(row.unit_price)}
      </Amount>
      <View style={s.row}>
        <Btn title="−" variant="alt" onPress={() => setQty(String(Math.max(1, n - 1)))} />
        <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad"
          style={[s.input, { width: 84, textAlign: 'center', borderColor: t.line, backgroundColor: t.panel, color: t.ink }]} />
        <Btn title="+" variant="alt" onPress={() => setQty(String(Math.min(row.quantity, n + 1)))} />
        <Btn title="Max" variant="alt" onPress={() => setQty(String(row.quantity))} />
      </View>
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
