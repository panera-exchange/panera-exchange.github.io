import { useEffect, useState, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { fonts, useTheme } from '@/theme'
import { Btn, Card, ItemIcon, Txt, fmt } from '@/components/ui'
import { compareMoney, exceedsTosiLimit, money, parseTosi } from '@/lib/format'

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

export type EditableListing = { id: string; name: string; quantity: number; unit_price: string; note: string | null }

// Crea una nuova offerta/richiesta, oppure (se c'è "listing") modifica quantità, prezzo e note.
export function ListingDialog({ kind, listing, onClose, onDone }: {
  kind: 'offer' | 'request'; listing?: EditableListing; onClose: () => void; onDone: (message: string) => void
}) {
  const t = useTheme()
  const [item, setItem] = useState<Picked | null>(null)
  const [qty, setQty] = useState(listing ? String(listing.quantity) : '10')
  const [price, setPrice] = useState(listing ? money(listing.unit_price) : '10')
  const [note, setNote] = useState(listing?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = [s.input, { borderColor: t.line, backgroundColor: t.panel, color: t.ink }]
  const parsedPrice = parseTosi(price)

  async function save() {
    setErr('')
    const q = Number(qty)
    if (!listing && !item) return setErr('Scegli un item dalla lista.')
    if (!Number.isInteger(q) || q < 1) return setErr('La quantità deve essere un numero intero di almeno 1.')
    if (q > 1000000) return setErr('La quantità massima è 1.000.000.')
    if (!parsedPrice) return setErr('Inserisci un prezzo valido, usando virgola o punto per i decimali.')
    if (compareMoney(parsedPrice.value, '0.00001') < 0) return setErr('Il prezzo minimo dopo il troncamento è 0,00001 Tosi.')
    if (exceedsTosiLimit(price, 100000000n)) return setErr('Il prezzo massimo è 100.000.000 Tosi.')
    setBusy(true)
    const { error } = listing
      ? await supabase.rpc('update_listing', { p_listing_id: listing.id, p_quantity: q, p_unit_price: parsedPrice.value, p_note: note })
      : await supabase.rpc('create_listing', { p_kind: kind, p_item_id: item!.id, p_quantity: q, p_unit_price: parsedPrice.value, p_note: note })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone(listing ? 'Annuncio aggiornato.'
      : kind === 'offer' ? `Offerta pubblicata: ${q} ${item!.name} a ${fmt(parsedPrice.value)} Tosi l'uno.`
      : `Richiesta pubblicata: cerchi ${q} ${item!.name} a ${fmt(parsedPrice.value)} Tosi l'uno.`)
  }

  return (
    <Dialog onClose={onClose}>
      <Txt variant="title">{listing ? `Modifica ${listing.name}` : kind === 'offer' ? 'Nuova offerta' : 'Nuova richiesta'}</Txt>
      {!listing && <ItemPicker value={item} onChange={setItem} />}
      <Txt variant="muted">Quantità</Txt>
      <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" style={input} />
      <Txt variant="muted">Prezzo per unità (Tosi)</Txt>
      <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={input} />
      {parsedPrice?.truncated && <Txt variant="muted">Verrà salvato come {fmt(parsedPrice.value)} Tosi.</Txt>}
      <Txt variant="muted">Note (facoltativo)</Txt>
      <TextInput value={note} onChangeText={setNote} maxLength={60} placeholder="es. Efficiency V" placeholderTextColor={t.muted} style={input} />
      {!listing && (
        <Txt variant="muted">
          {kind === 'offer' ? 'Chi compra potrà prendere anche meno unità.' : 'Chi vende potrà consegnarti anche meno unità.'}
        </Txt>
      )}
      {!!err && <Txt variant="error">{err}</Txt>}
      <View style={s.row}>
        <Btn title="Annulla" variant="alt" onPress={onClose} />
        <Btn title={listing ? 'Salva modifiche' : 'Pubblica'} onPress={save} disabled={busy} />
      </View>
    </Dialog>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: { borderWidth: 3, paddingHorizontal: 8, paddingVertical: 4, fontFamily: fonts.body, fontSize: 22 },
})
