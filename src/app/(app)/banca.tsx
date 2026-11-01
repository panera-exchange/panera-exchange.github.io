import { useCallback, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native'
import { Redirect, useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { useToast } from '@/lib/toast'
import { fonts, useTheme } from '@/theme'
import { compareMoney, exceedsTosiLimit, fmtDate, lots, money, parseTosi } from '@/lib/format'
import { Amount, Badge, Btn, Card, ItemIcon, Select, Txt, fmt } from '@/components/ui'
import { TopNav, pageContent } from '@/components/shell'
import { ConfirmDialog, Dialog } from '@/components/dialogs'
import { ReserveSummary, type ReserveCheck } from '@/components/home-dialogs'

// Saldo libero e Tosi bloccati negli acquisti in attesa (admin_accounts).
type Account = { id: string; username: string; balance: string; held: string }
// Ordine in attesa di chiunque (admin_orders).
type PendingOrder = {
  id: string; item_id: string; item_name: string; quantity: number; lot_size: number; lot_price: string
  buyer_id: string; buyer: string; seller_id: string; seller: string; created_at: string; delivered_at: string | null
}
type Operation = 'deposit' | 'withdraw' | 'add' | 'remove'
type Closing = { order: PendingOrder; type: 'cancel' | 'confirm' }

const OPERATIONS: { value: Operation; label: string }[] = [
  { value: 'deposit', label: 'Deposito di diamanti' },
  { value: 'withdraw', label: 'Prelievo di diamanti' },
  { value: 'add', label: 'Rettifica: aggiungi Tosi' },
  { value: 'remove', label: 'Rettifica: togli Tosi' },
]

const MAX_DIAMONDS = 1000000

// Banca: strumenti degli admin. Ogni funzione chiamata qui controlla di nuovo nel database che l'utente sia admin.
export default function Banca() {
  const { session, username, isAdmin, refreshBalance } = useSession()
  const toast = useToast()
  const t = useTheme()
  const { width } = useWindowDimensions()
  const wide = width >= 700
  const me = session?.user.id
  const [check, setCheck] = useState<ReserveCheck | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [error, setError] = useState('')
  const [user, setUser] = useState('')
  const [op, setOp] = useState<Operation>('deposit')
  const [qty, setQty] = useState('')
  const [memo, setMemo] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [closing, setClosing] = useState<Closing | null>(null)

  const load = useCallback(async () => {
    if (!isAdmin) return
    const [chk, acc, ord] = await Promise.all([
      supabase.rpc('reserve_check'),
      supabase.rpc('admin_accounts'),
      supabase.rpc('admin_orders'),
    ])
    const failure = chk.error ?? acc.error ?? ord.error
    if (failure) return setError(failure.message)
    setError('')
    const list = (acc.data ?? []) as Account[]
    setCheck(chk.data as ReserveCheck)
    setAccounts(list)
    setOrders((ord.data ?? []) as PendingOrder[])
    setUser((u) => u || list[0]?.id || '')
  }, [isAdmin])

  useFocusEffect(useCallback(() => { load() }, [load]))

  // Il profilo arriva dopo la sessione: finché non c'è, non si sa ancora se l'utente è admin.
  if (!username) return <View style={{ flex: 1, backgroundColor: t.bg }}><ActivityIndicator style={{ marginTop: 80 }} /></View>
  if (!isAdmin) return <Redirect href="/" />

  const account = accounts.find((a) => a.id === user)
  const inDiamonds = op === 'deposit' || op === 'withdraw'
  const diamonds = /^\d+$/.test(qty.trim()) ? Number(qty) : NaN
  const parsed = parseTosi(qty)
  const rate = check?.rate ?? '0'
  // Importo in Tosi dell'operazione, oppure null se la quantità non è valida.
  const amount = inDiamonds
    ? Number.isSafeInteger(diamonds) && diamonds >= 1 && diamonds <= MAX_DIAMONDS ? money(rate, diamonds) : null
    : parsed && compareMoney(parsed.value, '0.00001') >= 0 && !exceedsTosiLimit(qty, 1000000000n) ? parsed.value : null
  const spends = op === 'withdraw' || op === 'remove'

  let problem = ''
  if (!account) problem = 'Scegli un utente.'
  else if (amount === null) problem = inDiamonds
    ? `Scrivi un numero intero di diamanti tra 1 e ${fmt(MAX_DIAMONDS)}.`
    : 'Scrivi un importo valido (minimo 0,00001, massimo 1.000.000.000 Tosi).'
  else if (spends && compareMoney(amount, account.balance) > 0) problem = `Il saldo libero di ${account.username} non basta.`
  else if (op === 'withdraw' && check && compareMoney(String(diamonds), check.reserve) > 0) problem = `In riserva ci sono solo ${fmt(check.reserve)} diamanti.`
  else if (!memo.trim()) problem = 'Scrivi una causale.'

  function summary(): string {
    if (!account || amount === null) return ''
    const who = account.username
    if (op === 'deposit') return `${who} riceve ${fmt(amount)} Tosi per ${fmt(diamonds)} diamanti depositati. La riserva sale a ${fmt(Number(check?.reserve ?? 0) + diamonds)} diamanti.`
    if (op === 'withdraw') return `${who} perde ${fmt(amount)} Tosi per ${fmt(diamonds)} diamanti prelevati. La riserva scende a ${fmt(Number(check?.reserve ?? 0) - diamonds)} diamanti.`
    if (op === 'add') return `${who} riceve ${fmt(amount)} Tosi senza diamanti: la verifica della riserva mostrerà la differenza.`
    return `A ${who} vengono tolti ${fmt(amount)} Tosi senza diamanti: la verifica della riserva mostrerà la differenza.`
  }

  async function run() {
    if (!account || amount === null) return
    setBusy(true)
    setErr('')
    const { error } = op === 'deposit' ? await supabase.rpc('bcp_deposit', { p_profile_id: account.id, p_diamonds: diamonds, p_memo: memo })
      : op === 'withdraw' ? await supabase.rpc('bcp_withdraw', { p_profile_id: account.id, p_diamonds: diamonds, p_memo: memo })
      : await supabase.rpc('adjust_tosi', { p_profile_id: account.id, p_amount: op === 'add' ? amount : `-${amount}`, p_memo: memo })
    setBusy(false)
    if (error) return setErr(error.message)
    setConfirming(false)
    setQty('')
    setMemo('')
    toast(op === 'deposit' ? `Deposito registrato: ${fmt(amount)} Tosi a ${account.username}.`
      : op === 'withdraw' ? `Prelievo registrato: ${fmt(amount)} Tosi tolti a ${account.username}.`
      : `Rettifica registrata per ${account.username}.`)
    await refreshBalance()
    load()
  }

  const input = [s.input, { borderColor: t.line, backgroundColor: t.panel, color: t.ink }]

  function orderCard(o: PendingOrder) {
    const involved = me === o.buyer_id || me === o.seller_id
    return (
      <Card style={[s.order, wide && s.orderWide]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.row}>
            <ItemIcon id={o.item_id} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="title">{fmt(o.quantity * o.lot_size)} × {o.item_name}</Txt>
              {o.lot_size > 1 && <Txt variant="muted">{lots(o.quantity)} da {fmt(o.lot_size)}</Txt>}
              <Txt variant="muted">{o.seller} vende a {o.buyer} · {fmtDate(o.created_at)}</Txt>
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            <Amount variant="price">{fmt(money(o.lot_price, o.quantity))}</Amount>
          </View>
          <View style={{ marginTop: 8 }}>
            <Badge text={o.delivered_at ? `Consegnato ${fmtDate(o.delivered_at)}` : 'Da consegnare'} tone={o.delivered_at ? 'green' : 'gold'} />
          </View>
          {involved && <Txt variant="muted" style={{ marginTop: 4 }}>Sei coinvolto in questo ordine: deve chiuderlo un altro admin.</Txt>}
        </View>
        {!involved && (
          <View style={[s.actions, wide && s.actionsWide]}>
            <View style={wide ? s.actionWide : s.action}>
              <Btn title="Concludi" full onPress={() => setClosing({ order: o, type: 'confirm' })} />
            </View>
            <View style={wide ? s.actionWide : s.action}>
              <Btn title="Annulla" variant="danger" full onPress={() => setClosing({ order: o, type: 'cancel' })} />
            </View>
          </View>
        )}
      </Card>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={pageContent}>
        <TopNav />
        <Txt variant="title">Banca</Txt>
        <Txt variant="muted">Strumenti degli admin: depositi e prelievi di diamanti, rettifiche, ordini bloccati e verifica della riserva.</Txt>
        {!!error && <Txt variant="error">{error}</Txt>}

        <Card style={{ gap: 8 }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Txt variant="title">Verifica della riserva</Txt>
            <Btn title="Aggiorna" variant="alt" onPress={load} />
          </View>
          {check ? <ReserveSummary check={check} /> : <ActivityIndicator />}
        </Card>

        <Card style={{ gap: 8 }}>
          <Txt variant="title">Operazioni sui conti</Txt>
          <Txt variant="muted">Utente</Txt>
          <Select value={user} options={accounts.map((a) => ({ value: a.id, label: a.username }))} onChange={setUser} />
          {account && (
            <Amount variant="muted" after={compareMoney(account.held, '0') > 0 ? `liberi, ${fmt(account.held)} bloccati in acquisti` : 'liberi'}>
              {fmt(account.balance)}
            </Amount>
          )}
          <Txt variant="muted">Operazione</Txt>
          <Select value={op} options={OPERATIONS} onChange={(v) => { setOp(v); setQty('') }} width={300} />
          <Txt variant="muted">{inDiamonds ? 'Diamanti' : 'Tosi'}</Txt>
          <TextInput value={qty} onChangeText={setQty} keyboardType={inDiamonds ? 'number-pad' : 'decimal-pad'}
            placeholder={inDiamonds ? 'es. 5' : 'es. 100'} placeholderTextColor={t.muted} style={[input, { width: 160 }]} />
          {inDiamonds && amount !== null && (
            <Amount variant="muted" after={`al tasso di ${fmt(rate)} Tosi per diamante`}>{fmt(diamonds)} diamanti = {fmt(amount)}</Amount>
          )}
          {!inDiamonds && parsed?.truncated && <Txt variant="muted">Verrà salvato come {fmt(parsed.value)} Tosi.</Txt>}
          <Txt variant="muted">Causale</Txt>
          <TextInput value={memo} onChangeText={setMemo} maxLength={120} placeholderTextColor={t.muted} style={input}
            placeholder={inDiamonds ? 'es. Deposito allo sportello di Brasimogne' : 'es. Premio del torneo di ottobre'} />
          {!!problem && !!qty && <Txt variant="error">{problem}</Txt>}
          <View style={s.row}>
            <Btn title="Esegui" onPress={() => { setErr(''); setConfirming(true) }} disabled={!!problem} />
          </View>
        </Card>

        <Card style={{ gap: 6 }}>
          <Txt variant="title">Conti</Txt>
          {accounts.map((a) => (
            <View key={a.id} style={[s.row, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}>
              <Txt style={{ flexShrink: 1 }} numberOfLines={1}>{a.username}</Txt>
              <Amount after={compareMoney(a.held, '0') > 0 ? `+ ${fmt(a.held)} bloccati` : undefined}>{fmt(a.balance)}</Amount>
            </View>
          ))}
        </Card>

        <Txt variant="title" style={{ marginTop: 8 }}>Ordini in attesa</Txt>
        <Txt variant="muted">
          Annulla se chi vende non ha consegnato: i Tosi tornano a chi compra. Concludi se chi compra ha ritirato gli item
          ma non preme Ricevuto: i Tosi vanno a chi vende. Entrambi vedono la motivazione.
        </Txt>
        {orders.length === 0
          ? <Txt>Nessun ordine in attesa.</Txt>
          : <View style={{ gap: 16 }}>{orders.map((o) => <View key={o.id}>{orderCard(o)}</View>)}</View>}
      </ScrollView>

      {confirming && (
        <ConfirmDialog title={OPERATIONS.find((o) => o.value === op)?.label ?? ''} text={`${summary()} Causale: ${memo.trim()}`}
          confirmLabel="Conferma" danger={spends} busy={busy} error={err} onConfirm={run} onClose={() => setConfirming(false)} />
      )}
      {closing && (
        <CloseOrderDialog closing={closing} onClose={() => setClosing(null)}
          onDone={(message) => { setClosing(null); toast(message); load() }} />
      )}
    </View>
  )
}

// Chiusura di un ordine altrui da admin, con la motivazione che vedranno chi compra e chi vende.
function CloseOrderDialog({ closing, onClose, onDone }: {
  closing: Closing; onClose: () => void; onDone: (message: string) => void
}) {
  const t = useTheme()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const { order: o, type } = closing
  const total = fmt(money(o.lot_price, o.quantity))
  const cancel = type === 'cancel'

  async function confirm() {
    if (!reason.trim()) return setErr('Scrivi una motivazione.')
    setBusy(true)
    setErr('')
    const { error } = await supabase.rpc(cancel ? 'admin_cancel_order' : 'admin_confirm_order', { p_order_id: o.id, p_reason: reason })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone(cancel ? `Ordine annullato: ${total} Tosi restituiti a ${o.buyer}.` : `Ordine concluso: ${total} Tosi pagati a ${o.seller}.`)
  }

  return (
    <Dialog onClose={onClose} scrollable>
      <Txt variant="title">{cancel ? "Annullare l'ordine?" : "Concludere l'ordine?"}</Txt>
      <Txt variant="muted">
        {fmt(o.quantity * o.lot_size)} {o.item_name}, {o.seller} vende a {o.buyer}.{' '}
        {cancel ? `I ${total} Tosi tornano a ${o.buyer} e i lotti all'annuncio.` : `I ${total} Tosi vanno a ${o.seller}.`} Non si può annullare.
      </Txt>
      <Txt variant="muted">Motivazione (la vedono {o.buyer} e {o.seller})</Txt>
      <TextInput value={reason} onChangeText={setReason} maxLength={120} placeholderTextColor={t.muted}
        placeholder={cancel ? 'es. Consegna mai avvenuta, verificato in gioco' : 'es. Item ritirati, verificato in gioco'}
        style={[s.input, { borderColor: t.line, backgroundColor: t.panel, color: t.ink }]} />
      {!!err && <Txt variant="error">{err}</Txt>}
      <View style={s.row}>
        <Btn title="Indietro" variant="alt" onPress={onClose} />
        <Btn title={cancel ? 'Annulla ordine' : 'Concludi ordine'} variant={cancel ? 'danger' : 'primary'} onPress={confirm} disabled={busy} />
      </View>
    </Dialog>
  )
}

const s = StyleSheet.create({
  input: { borderWidth: 3, paddingHorizontal: 8, paddingVertical: 4, fontFamily: fonts.body, fontSize: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  order: { gap: 12 },
  orderWide: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  actionsWide: { width: 140, flexDirection: 'column' },
  action: { flex: 1 },
  actionWide: { width: '100%' },
})
