import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { useToast } from '@/lib/toast'
import { useTheme } from '@/theme'
import { fmtDate, lots, money, stacks } from '@/lib/format'
import { Amount, Badge, Btn, Card, ItemIcon, Txt, fmt } from '@/components/ui'
import { TopNav, pageContent } from '@/components/shell'
import { ConfirmDialog } from '@/components/dialogs'
import { useOrderAlerts } from '@/lib/order-alerts'

// quantity conta i lotti presi, ciascuno da lot_size pezzi al prezzo lot_price.
type Order = {
  id: string; quantity: number; lot_size: number; lot_price: string; status: 'pending' | 'completed' | 'cancelled'
  created_at: string; delivered_at: string | null; buyer_id: string; seller_id: string; item_id: string
  items: { name: string; stack_size: number } | null; buyer: { username: string } | null; seller: { username: string } | null
}

// "128 Cookie (2 stack)": i pezzi da scambiare in gioco.
function piecesText(o: Order): string {
  const pieces = o.quantity * o.lot_size
  const hint = stacks(pieces, o.items?.stack_size ?? 64)
  return `${fmt(pieces)} ${o.items?.name ?? o.item_id}${hint ? ` (${hint})` : ''}`
}
type Pending = { order: Order; type: 'deliver' | 'confirm' | 'cancel' }

const STATUS = { pending: 'In attesa', completed: 'Concluso', cancelled: 'Annullato' } as const
const FN = { deliver: 'mark_delivered', confirm: 'confirm_order', cancel: 'cancel_order' } as const
const TONE = { pending: 'gold', completed: 'green', cancelled: 'gray' } as const

export default function Ordini() {
  const { session, refreshBalance } = useSession()
  const alerts = useOrderAlerts()
  const toast = useToast()
  const t = useTheme()
  const { width } = useWindowDimensions()
  const wide = width >= 700
  const me = session?.user.id
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [action, setAction] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, quantity, lot_size, lot_price::text, status, created_at, delivered_at, buyer_id, seller_id, item_id, items(name, stack_size), buyer:profiles!buyer_id(username), seller:profiles!seller_id(username)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else {
      setError('')
      setOrders((data ?? []) as unknown as Order[])
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))
  // Si ricarica anche a pagina aperta quando arrivano novità (es. l'altra parte ha segnato la consegna).
  const { subscribe } = alerts
  useEffect(() => subscribe(() => { load() }), [subscribe, load])

  // Tocca a me: consegnare se vendo, ritirare se compro e la consegna è segnata. Questi vanno in cima.
  const myTurn = useCallback((o: Order) => o.buyer_id === me ? !!o.delivered_at : !o.delivered_at, [me])
  const todo = useMemo(() => orders.filter((o) => o.status === 'pending')
    .sort((a, b) => Number(myTurn(b)) - Number(myTurn(a))), [orders, myTurn])
  const done = useMemo(() => orders.filter((o) => o.status !== 'pending'), [orders])

  async function run() {
    if (!action) return
    setBusy(true)
    setErr('')
    const { error } = await supabase.rpc(FN[action.type], { p_order_id: action.order.id })
    setBusy(false)
    if (error) return setErr(error.message)
    setAction(null)
    toast(action.type === 'deliver' ? `Consegna segnata: ${action.order.buyer?.username} riceverà un avviso.`
      : action.type === 'confirm' ? `Scambio concluso: ${fmt(money(action.order.lot_price, action.order.quantity))} Tosi a ${action.order.seller?.username}.`
      : 'Ordine annullato.')
    await refreshBalance()
    alerts.refresh()
    load()
  }

  function dialogText(a: Pending) {
    const o = a.order
    const total = fmt(money(o.lot_price, o.quantity))
    if (a.type === 'deliver') return `Confermi di aver consegnato ${piecesText(o)} a ${o.buyer?.username} in gioco? Riceverà un avviso per ritirarli e premere Ricevuto.`
    if (a.type === 'confirm') return `Confermi di aver ricevuto ${piecesText(o)}? I ${total} Tosi andranno a ${o.seller?.username}. Non si può annullare.`
    return o.buyer_id === me
      ? `L'ordine verrà annullato e i ${total} Tosi ti verranno restituiti.`
      : `L'ordine verrà annullato e i ${total} Tosi torneranno a ${o.buyer?.username}.`
  }

  function card(o: Order) {
    const buyer = o.buyer_id === me
    const name = o.items?.name ?? o.item_id
    const delivered = !!o.delivered_at
    const pending = o.status === 'pending'
    return (
      <Card style={[s.order, wide && s.orderWide]}>
        <View style={s.orderDetails}>
          <View style={s.row}>
            <ItemIcon id={o.item_id} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="title">{fmt(o.quantity * o.lot_size)} × {name}</Txt>
              {o.lot_size > 1 && <Txt variant="muted">{lots(o.quantity)} da {fmt(o.lot_size)}</Txt>}
              <Txt variant="muted">{buyer ? `Acquisto da ${o.seller?.username}` : `Vendita a ${o.buyer?.username}`} · {fmtDate(o.created_at)}</Txt>
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            <Amount variant="price">{fmt(money(o.lot_price, o.quantity))}</Amount>
          </View>
          {pending && (
            <Txt style={{ marginTop: 4 }}>
              {buyer
                ? delivered ? `${o.seller?.username} ha consegnato (${fmtDate(o.delivered_at!)}): ritira ${piecesText(o)} in gioco, poi premi Ricevuto.`
                  : `Aspetta che ${o.seller?.username} consegni in gioco: riceverai un avviso.`
                : delivered ? `Consegnato (${fmtDate(o.delivered_at!)}): aspetta che ${o.buyer?.username} prema Ricevuto.`
                  : `Consegna ${piecesText(o)} a ${o.buyer?.username} in gioco, poi premi Consegnato.`}
            </Txt>
          )}
          <View style={{ marginTop: 8 }}>
            <Badge text={pending ? (delivered ? 'Consegnato' : 'Da consegnare') : STATUS[o.status]} tone={TONE[o.status]} />
          </View>
        </View>
        {pending && (
          <View style={[s.orderActions, wide && s.orderActionsWide]}>
            {buyer && delivered && <View style={wide ? s.actionButtonWide : s.actionButton}><Btn title="Ricevuto" full onPress={() => { setErr(''); setAction({ order: o, type: 'confirm' }) }} /></View>}
            {!buyer && !delivered && <View style={wide ? s.actionButtonWide : s.actionButton}><Btn title="Consegnato" full onPress={() => { setErr(''); setAction({ order: o, type: 'deliver' }) }} /></View>}
            {/* Dopo la consegna può annullare solo chi vende: chi compra ha già gli item. */}
            {!(buyer && delivered) && <View style={wide ? s.actionButtonWide : s.actionButton}><Btn title="Annulla" variant="danger" full onPress={() => { setErr(''); setAction({ order: o, type: 'cancel' }) }} /></View>}
          </View>
        )}
      </Card>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pageContent}>
        <TopNav />
        <Txt variant="muted">Chi vende consegna in gioco e preme Consegnato, poi chi compra ritira e preme Ricevuto. Fino ad allora i Tosi restano bloccati.</Txt>
        {!!error && <Txt variant="error">{error}</Txt>}
        <Txt variant="title">Da fare</Txt>
        {todo.length === 0 ? <Txt>Niente da fare per ora.</Txt> : <View style={s.list}>{todo.map((o) => <View key={o.id}>{card(o)}</View>)}</View>}
        <Txt variant="title" style={{ marginTop: 8 }}>Conclusi</Txt>
        {done.length === 0 ? <Txt>Nessun ordine concluso.</Txt> : <View style={s.list}>{done.map((o) => <View key={o.id}>{card(o)}</View>)}</View>}
      </ScrollView>
      {action && (
        <ConfirmDialog
          title={action.type === 'deliver' ? 'Confermi la consegna?' : action.type === 'confirm' ? 'Confermi la ricezione?' : "Annullare l'ordine?"}
          text={dialogText(action)} confirmLabel={action.type === 'deliver' ? 'Consegnato' : action.type === 'confirm' ? 'Ricevuto' : 'Annulla ordine'}
          danger={action.type === 'cancel'} busy={busy} error={err} onConfirm={run} onClose={() => setAction(null)} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  list: { gap: 16 },
  order: { gap: 12 },
  orderWide: { flexDirection: 'row', alignItems: 'center' },
  orderDetails: { flex: 1, minWidth: 0 },
  orderActions: { flexDirection: 'row', gap: 8 },
  orderActionsWide: { width: 140, flexDirection: 'column' },
  actionButton: { flex: 1 },
  actionButtonWide: { width: '100%' },
})
