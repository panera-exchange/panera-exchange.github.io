import { useState } from 'react'
import { Platform, StyleSheet, TextInput, View, type TextStyle } from 'react-native'
import { supabase } from '@/lib/supabase'
import { fonts, useTheme } from '@/theme'
import { Btn, Txt } from '@/components/ui'
import { Dialog } from '@/components/dialogs'
import { compareMoney, exceedsTosiLimit, fmt, money, parseTosi } from '@/lib/format'

export type EditableArticle = { id: string; title: string; body: string }

// Crea o modifica un articolo (solo admin).
export function ArticleDialog({ article, onClose, onDone }: {
  article?: EditableArticle; onClose: () => void; onDone: (message: string) => void
}) {
  const t = useTheme()
  const [title, setTitle] = useState(article?.title ?? '')
  const [body, setBody] = useState(article?.body ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = [s.input, { borderColor: t.line, backgroundColor: t.panel, color: t.ink }]
  const hiddenTextScrollbar = Platform.OS === 'web' ? ({ scrollbarWidth: 'none' } as TextStyle) : undefined
  const unchanged = !!article && title.trim() === article.title && body.trim() === article.body

  async function save() {
    if (!title.trim()) return setErr('Scrivi un titolo.')
    if (!body.trim()) return setErr('Scrivi il testo dell\'articolo.')
    setBusy(true)
    setErr('')
    const { error } = article
      ? await supabase.rpc('update_article', { p_article_id: article.id, p_title: title.trim(), p_body: body.trim() })
      : await supabase.rpc('create_article', { p_title: title.trim(), p_body: body.trim() })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone(article ? 'Articolo aggiornato.' : 'Articolo pubblicato.')
  }

  return (
    <Dialog onClose={onClose} scrollable>
      <Txt variant="title">{article ? 'Modifica articolo' : 'Nuovo articolo'}</Txt>
      <Txt variant="muted">Titolo</Txt>
      <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Titolo" placeholderTextColor={t.muted} style={input} />
      <Txt variant="muted">Testo</Txt>
      <TextInput value={body} onChangeText={setBody} maxLength={5000} multiline numberOfLines={8} textAlignVertical="top"
        placeholder="Scrivi qui l'articolo..." placeholderTextColor={t.muted} style={[input, { minHeight: 180 }, hiddenTextScrollbar]} />
      {!!err && <Txt variant="error">{err}</Txt>}
      <View style={s.row}>
        <Btn title="Annulla" variant="alt" onPress={onClose} />
        <Btn title={article ? 'Salva modifiche' : 'Pubblica'} onPress={save} disabled={busy || unchanged} />
      </View>
    </Dialog>
  )
}

// Modifica dei dati della Banca Centrale Panera (solo admin).
export function BcpDialog({ rate, reserve, onClose, onDone }: {
  rate: string; reserve: number; onClose: () => void; onDone: (message: string) => void
}) {
  const t = useTheme()
  const [r, setR] = useState(money(rate))
  const [v, setV] = useState(String(reserve))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = [s.input, { borderColor: t.line, backgroundColor: t.panel, color: t.ink }]
  const parsedRate = parseTosi(r)
  // Cambiando il tasso il database ricalcola saldi e prezzi (update_bcp): l'admin lo deve sapere prima.
  const rescale = !!parsedRate && compareMoney(rate, '0') > 0 && compareMoney(parsedRate.value, '0.00001') >= 0
    && compareMoney(parsedRate.value, rate) !== 0
  const ratio = rescale ? (Number(parsedRate.value) / Number(rate)).toLocaleString('it-IT', { maximumFractionDigits: 5 }) : ''

  async function save() {
    const reserveN = Number(v)
    if (!parsedRate) return setErr('Inserisci un tasso valido, usando virgola o punto per i decimali.')
    if (compareMoney(parsedRate.value, '0.00001') < 0) return setErr('Il tasso minimo dopo il troncamento è 0,00001.')
    if (exceedsTosiLimit(r, 100000000n)) return setErr('Il tasso massimo è 100.000.000.')
    if (!Number.isInteger(reserveN) || reserveN < 0) return setErr('La riserva deve essere un numero intero, zero o più.')
    setBusy(true)
    setErr('')
    const { error } = await supabase.rpc('update_bcp', { p_rate: parsedRate.value, p_reserve: reserveN })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone(rescale ? 'Dati BCP aggiornati: saldi e prezzi ricalcolati al nuovo tasso.' : 'Dati BCP aggiornati.')
  }

  return (
    <Dialog onClose={onClose} scrollable>
      <Txt variant="title">Dati BCP</Txt>
      <Txt variant="muted">Tosi per 1 diamante</Txt>
      <TextInput value={r} onChangeText={setR} keyboardType="decimal-pad" style={input} />
      {parsedRate?.truncated && <Txt variant="muted">Verrà salvato come {fmt(parsedRate.value)} Tosi.</Txt>}
      <Txt variant="muted">Riserva totale (diamanti)</Txt>
      <TextInput value={v} onChangeText={setV} keyboardType="number-pad" style={input} />
      {rescale && (
        <View style={[s.warning, { borderColor: t.gold }]}>
          <Txt variant="title">Attenzione</Txt>
          <Txt>
            Da {fmt(rate)} a {fmt(parsedRate.value)} Tosi per diamante: saldi di tutti gli utenti e prezzi di tutti gli
            annunci (anche esauriti) verranno moltiplicati per {ratio}, così mantengono lo stesso valore in diamanti.
          </Txt>
          <Txt variant="muted">Gli ordini in attesa non cambiano: si chiudono alla cifra concordata. Non si può annullare.</Txt>
        </View>
      )}
      {!!err && <Txt variant="error">{err}</Txt>}
      <View style={s.row}>
        <Btn title="Annulla" variant="alt" onPress={onClose} />
        <Btn title={rescale ? 'Salva e ricalcola' : 'Salva'} variant={rescale ? 'danger' : 'primary'} onPress={save} disabled={busy} />
      </View>
    </Dialog>
  )
}

const s = StyleSheet.create({
  input: { borderWidth: 3, paddingHorizontal: 8, paddingVertical: 4, fontFamily: fonts.body, fontSize: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  warning: { borderWidth: 3, padding: 8, gap: 4 },
})
