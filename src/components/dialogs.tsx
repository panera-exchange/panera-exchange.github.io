import { useEffect, useState, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { fonts, useTheme } from '@/theme'
import { Amount, Btn, Card, ItemIcon, Txt, fmt } from '@/components/ui'
import { compareMoney, exceedsTosiLimit, lots, money, parseTosi, perUnit, stacks } from '@/lib/format'

export function Dialog({ children, onClose, scrollable = false }: { children: ReactNode; onClose: () => void; scrollable?: boolean }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Card style={{ width: '100%', maxWidth: 420, maxHeight: scrollable ? '90%' : undefined, gap: 8 }}>
          {scrollable
            ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{children}</ScrollView>
            : children}
        </Card>
      </View>
    </Modal>
  )
}

// Conferma prima di un'azione che non si può annullare (Alert non funziona bene sul web).
export function ConfirmDialog({ title, text, confirmLabel, danger, busy, error, onConfirm, onClose }: {
  title: string; text: string; confirmLabel: string; danger?: boolean; busy?: boolean; error?: string
  onConfirm: () => void; onClose: () => void
}) {
  return (
    <Dialog onClose={onClose}>
      <Txt variant="title">{title}</Txt>
      <Txt variant="muted">{text}</Txt>
      {!!error && <Txt variant="error">{error}</Txt>}
      <View style={s.row}>
        <Btn title="Indietro" variant="alt" onPress={onClose} />
        <Btn title={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} disabled={busy} />
      </View>
    </Dialog>
  )
}

type Picked = { id: string; name: string }

// Altezza fissa di una riga dei risultati, così l'elenco mostra sempre lo stesso numero di righe.
const RESULT_ROW = 40

// Ricerca nel catalogo: interroga il database mentre si scrive (il catalogo ha oltre 1.300 item).
function ItemPicker({ value, onChange }: { value: Picked | null; onChange: (i: Picked | null) => void }) {
  const t = useTheme()
  const [text, setText] = useState('')
  const [search, setSearch] = useState<{ needle: string; results: Picked[]; failed: boolean } | null>(null)
  const needle = text.trim()
  const currentSearch = !value && search?.needle === needle ? search : null
  const results = currentSearch?.results ?? []

  useEffect(() => {
    if (!needle || value) return
    let cancelled = false
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_items', { p_query: needle, p_limit: 30 })
      if (!cancelled) setSearch({ needle, results: data ?? [], failed: !!error })
    }, 250)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [needle, value])

  if (value) {
    return (
      <View style={s.row}>
        <ItemIcon id={value.id} size={32} />
        <Txt style={{ flex: 1 }}>{value.name}</Txt>
        <Btn title="Cambia" variant="alt" onPress={() => { onChange(null); setText('') }} />
      </View>
    )
  }
  return (
    <View style={{ gap: 6 }}>
      <TextInput value={text} onChangeText={setText} placeholder="Cerca un item (es. Obsidian)" placeholderTextColor={t.muted}
        autoCapitalize="none" style={[s.input, { borderColor: t.line, backgroundColor: t.panel, color: t.ink }]} />
      {results.length > 0 && (
        // Tre righe e mezza: quella tagliata fa capire che l'elenco continua scorrendo.
        <ScrollView style={{ maxHeight: RESULT_ROW * 3.5 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {results.map((r) => (
            <Pressable key={r.id} onPress={() => onChange(r)} style={[s.row, { height: RESULT_ROW, flexWrap: 'nowrap', borderBottomWidth: 2, borderColor: t.soft }]}>
              <ItemIcon id={r.id} size={28} />
              <Txt numberOfLines={1} style={{ flex: 1 }}>{r.name}</Txt>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {/diamant|diamond/i.test(needle) && (
        <Txt variant="muted">Diamanti, blocchi e minerali di diamante non si scambiano su PanEx: passano solo dalla BCP (art. 06).</Txt>
      )}
      {currentSearch?.failed && <Txt variant="error">Ricerca non disponibile. Riprova.</Txt>}
      {currentSearch && !currentSearch.failed && results.length === 0 && <Txt variant="muted">Nessun item trovato.</Txt>}
    </View>
  )
}

export type EditableListing = {
  id: string; item_id: string; name: string; stack_size: number
  quantity: number; lot_size: number; lot_price: string; note: string | null
}

const MAX_LOT = 1728 // una shulker piena di stack da 64
const MAX_PIECES = 1000000
const wholeNumber = (text: string) => /^\d+$/.test(text.trim()) ? Number(text) : NaN

// Crea una nuova offerta/richiesta, oppure (se c'è "listing") la modifica o la rifornisce se è esaurita.
// Si vende a lotti: pezzi per lotto, prezzo del lotto e numero di lotti. Un lotto da 1 è la vendita a unità.
export function ListingDialog({ kind, listing, onClose, onDone }: {
  kind: 'offer' | 'request'; listing?: EditableListing; onClose: () => void; onDone: (message: string) => void
}) {
  const t = useTheme()
  const [item, setItem] = useState<Picked | null>(null)
  const [stack, setStack] = useState(listing ? { id: listing.item_id, size: listing.stack_size } : null)
  const [lotSize, setLotSize] = useState(listing ? String(listing.lot_size) : '1')
  const [qty, setQty] = useState(listing ? (listing.quantity > 0 ? String(listing.quantity) : '') : '10')
  const [price, setPrice] = useState(listing ? money(listing.lot_price) : '10')
  const [note, setNote] = useState(listing?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = [s.input, { borderColor: t.line, backgroundColor: t.panel, color: t.ink }]
  const parsedPrice = parseTosi(price)
  const restock = listing?.quantity === 0
  const itemId = listing?.item_id ?? item?.id
  const name = listing?.name ?? item?.name
  const stackSize = stack && stack.id === itemId ? stack.size : null
  const size = wholeNumber(lotSize)
  const q = wholeNumber(qty)
  const validSize = Number.isSafeInteger(size) && size >= 1 && size <= MAX_LOT
  const validQty = Number.isSafeInteger(q) && q >= 1
  const isLot = validSize && size > 1
  const pieces = validSize && validQty ? q * size : 0
  const validPrice = !!parsedPrice && compareMoney(parsedPrice.value, '0.00001') >= 0 && !exceedsTosiLimit(price, 100000000n)
  const presets = stackSize === null ? [] : [
    ...(stackSize > 1 ? [{ label: `Stack (${stackSize})`, value: stackSize }] : []),
    { label: `Shulker (${fmt(stackSize * 27)})`, value: stackSize * 27 },
  ]

  // La dimensione dello stack serve per le scorciatoie: si legge quando si sceglie l'item.
  useEffect(() => {
    if (!itemId || stack?.id === itemId) return
    let cancelled = false
    supabase.from('items').select('stack_size').eq('id', itemId).single().then(({ data }) => {
      if (!cancelled && data) setStack({ id: itemId, size: data.stack_size })
    })
    return () => { cancelled = true }
  }, [itemId, stack])

  async function save() {
    setErr('')
    if (!listing && !item) return setErr('Scegli un item dalla lista.')
    if (!validSize) return setErr(`I pezzi per lotto devono essere un numero intero tra 1 e ${fmt(MAX_LOT)}.`)
    if (!validQty) return setErr(isLot ? 'I lotti devono essere un numero intero di almeno 1.' : 'La quantità deve essere un numero intero di almeno 1.')
    if (pieces > MAX_PIECES) return setErr('Al massimo 1.000.000 di pezzi in tutto per annuncio.')
    if (!parsedPrice) return setErr('Inserisci un prezzo valido, usando virgola o punto per i decimali.')
    if (compareMoney(parsedPrice.value, '0.00001') < 0) return setErr('Il prezzo minimo dopo il troncamento è 0,00001 Tosi.')
    if (exceedsTosiLimit(price, 100000000n)) return setErr('Il prezzo massimo è 100.000.000 Tosi.')
    setBusy(true)
    const fields = { p_quantity: q, p_lot_price: parsedPrice.value, p_lot_size: size, p_note: note }
    const { error } = listing
      ? await supabase.rpc('update_listing', { p_listing_id: listing.id, ...fields })
      : await supabase.rpc('create_listing', { p_kind: kind, p_item_id: item!.id, ...fields })
    setBusy(false)
    if (error) return setErr(error.message)
    const what = isLot ? `${lots(q)} da ${fmt(size)} ${name}` : `${fmt(q)} ${name}`
    const each = isLot ? 'al lotto' : "l'uno"
    onDone(restock ? 'Annuncio rifornito.' : listing ? 'Annuncio aggiornato.'
      : kind === 'offer' ? `Offerta pubblicata: ${what} a ${fmt(parsedPrice.value)} Tosi ${each}.`
      : `Richiesta pubblicata: cerchi ${what} a ${fmt(parsedPrice.value)} Tosi ${each}.`)
  }

  const hint = validSize && validQty && stackSize !== null ? stacks(pieces, stackSize) : ''

  return (
    <Dialog onClose={onClose} scrollable>
      <Txt variant="title">
        {restock ? `Rifornisci ${listing.name}` : listing ? `Modifica ${listing.name}` : kind === 'offer' ? 'Nuova offerta' : 'Nuova richiesta'}
      </Txt>
      {!listing && <ItemPicker value={item} onChange={setItem} />}
      <Txt variant="muted">Pezzi per lotto</Txt>
      <View style={s.row}>
        <TextInput value={lotSize} onChangeText={setLotSize} keyboardType="number-pad" style={[input, { width: 96, textAlign: 'center' }]} />
        <Btn title="1" variant="alt" active={lotSize.trim() === '1'} onPress={() => setLotSize('1')} />
        {presets.map((p) => (
          <Btn key={p.label} title={p.label} variant="alt" active={size === p.value} onPress={() => setLotSize(String(p.value))} />
        ))}
      </View>
      <Txt variant="muted">{isLot ? 'Prezzo per lotto (Tosi)' : 'Prezzo per unità (Tosi)'}</Txt>
      <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={input} />
      {parsedPrice?.truncated && <Txt variant="muted">Verrà salvato come {fmt(parsedPrice.value)} Tosi.</Txt>}
      <Txt variant="muted">{!isLot ? 'Quantità' : kind === 'offer' ? 'Lotti disponibili' : 'Lotti richiesti'}</Txt>
      <View style={s.row}>
        <Btn title="−" variant="alt" onPress={() => setQty(String(Math.max(1, (validQty ? q : 1) - 1)))} />
        <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" style={[input, { width: 96, textAlign: 'center' }]} />
        <Btn title="+" variant="alt" onPress={() => setQty(String((validQty ? q : 0) + 1))} />
      </View>
      <Txt variant="muted">Note (facoltativo)</Txt>
      <TextInput value={note} onChangeText={setNote} maxLength={60} placeholder="es. Efficiency V" placeholderTextColor={t.muted} style={input} />
      {validSize && validQty && validPrice && (
        <View style={[s.summary, { borderColor: t.soft }]}>
          {isLot && (
            <>
              <Txt>{lots(q)} da {fmt(size)} = {fmt(pieces)} {name ?? 'pezzi'}{hint ? ` (${hint})` : ''}</Txt>
              <Amount variant="muted" after="/ unità">≈ {fmt(perUnit(parsedPrice.value, size))}</Amount>
            </>
          )}
          <Amount variant="muted">Valore totale: {fmt(money(parsedPrice.value, q))}</Amount>
        </View>
      )}
      {!listing && (
        <Txt variant="muted">
          {kind === 'offer'
            ? isLot ? 'Chi compra sceglie quanti lotti prendere.' : 'Chi compra potrà prendere anche meno unità.'
            : isLot ? 'Chi vende sceglie quanti lotti consegnarti.' : 'Chi vende potrà consegnarti anche meno unità.'}
        </Txt>
      )}
      {!!err && <Txt variant="error">{err}</Txt>}
      <View style={s.row}>
        <Btn title="Annulla" variant="alt" onPress={onClose} />
        <Btn title={restock ? 'Riapri annuncio' : listing ? 'Salva modifiche' : 'Pubblica'} onPress={save} disabled={busy} />
      </View>
    </Dialog>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: { borderWidth: 3, paddingHorizontal: 8, paddingVertical: 4, fontFamily: fonts.body, fontSize: 22 },
  summary: { borderTopWidth: 2, borderStyle: 'dashed', paddingTop: 8, gap: 2 },
})
