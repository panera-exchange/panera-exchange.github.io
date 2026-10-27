import { useCallback, useMemo, useState } from 'react'
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

// quantity conta i lotti presi, ciascuno da lot_size pezzi al prezzo lot_price.
type Order = {
  id: string; quantity: number; lot_size: number; lot_price: string; status: 'pending' | 'completed' | 'cancelled'
  created_at: string; buyer_id: string; seller_id: string; item_id: string
  items: { name: string; stack_size: number } | null; buyer: { username: string } | null; seller: { username: string } | null
}

// "128 Cookie (2 stack)": i pezzi da scambiare in gioco.
function piecesText(o: Order): string {
  const pieces = o.quantity * o.lot_size
  const hint = stacks(pieces, o.items?.stack_size ?? 64)
  return `${fmt(pieces)} ${o.items?.name ?? o.item_id}${hint ? ` (${hint})` : ''}`
}
type Pending = { order: Order; type: 'confirm' | 'cancel' }

const STATUS = { pending: 'In attesa', completed: 'Concluso', cancelled: 'Annullato' } as const
const TONE = { pending: 'gold', completed: 'green', cancelled: 'gray' } as const

export default function Ordini() {
  const { session, refreshBalance } = useSession()
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
      .select('id, quantity, lot_size, lot_price::text, status, created_at, buyer_id, seller_id, item_id, items(name, stack_size), buyer:profiles!buyer_id(username), seller:profiles!seller_id(username)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else {
      setError('')
      setOrders((data ?? []) as unknown as Order[])
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const todo = useMemo(() => orders.filter((o) => o.status === 'pending'), [orders])
  const done = useMemo(() => orders.filter((o) => o.status !== 'pending'), [orders])

  async function run() {
    if (!action) return
    setBusy(true)
    setErr('')
    const fn = action.type === 'confirm' ? 'confirm_order' : 'cancel_order'
    const { error } = await supabase.rpc(fn, { p_order_id: action.order.id })
    setBusy(false)
    if (error) return setErr(error.message)
    setAction(null)
    toast(action.type === 'confirm'
      ? `Scambio concluso: ${fmt(money(action.order.lot_price, action.order.quantity))} Tosi a ${action.order.seller?.username}.`
      : 'Ordine annullato.')
    await refreshBalance()
    load()
  }

  function dialogText(a: Pending) {
    const o = a.order
    const total = fmt(money(o.lot_price, o.quantity))
    if (a.type === 'confirm') return `Confermi di aver ricevuto ${piecesText(o)}? I ${total} Tosi andranno a ${o.seller?.username}. Non si può annullare.`
    return o.buyer_id === me
      ? `L'ordine verrà annullato e i ${total} Tosi ti verranno restituiti.`
      : `L'ordine verrà annullato e i ${total} Tosi torneranno a ${o.buyer?.username}.`
  }

  function card(o: Order) {
    const buyer = o.buyer_id === me
    const name = o.items?.name ?? o.item_id
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
          {o.status === 'pending' && (
            <Txt style={{ marginTop: 4 }}>
              {buyer ? `Aspetta la consegna da ${o.seller?.username} in gioco, poi premi Ricevuto.`
                : `Consegna ${piecesText(o)} a ${o.buyer?.username} in gioco.`}
            </Txt>
          )}
          <View style={{ marginTop: 8 }}><Badge text={STATUS[o.status]} tone={TONE[o.status]} /></View>
        </View>
        {o.status === 'pending' && (
          <View style={[s.orderActions, wide && s.orderActionsWide]}>
            {buyer && <View style={wide ? s.actionButtonWide : s.actionButton}><Btn title="Ricevuto" full onPress={() => { setErr(''); setAction({ order: o, type: 'confirm' }) }} /></View>}
            <View style={wide ? s.actionButtonWide : s.actionButton}><Btn title="Annulla" variant="danger" full onPress={() => { setErr(''); setAction({ order: o, type: 'cancel' }) }} /></View>
          </View>
        )}
      </Card>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pageContent}>
        <TopNav />
        <Txt variant="muted">I Tosi restano bloccati finché il compratore non preme Ricevuto, dopo lo scambio in gioco.</Txt>
        {!!error && <Txt variant="error">{error}</Txt>}
        <Txt variant="title">Da fare</Txt>
        {todo.length === 0 ? <Txt>Niente da fare per ora.</Txt> : <View style={s.list}>{todo.map((o) => <View key={o.id}>{card(o)}</View>)}</View>}
        <Txt variant="title" style={{ marginTop: 8 }}>Conclusi</Txt>
        {done.length === 0 ? <Txt>Nessun ordine concluso.</Txt> : <View style={s.list}>{done.map((o) => <View key={o.id}>{card(o)}</View>)}</View>}
      </ScrollView>
      {action && (
        <ConfirmDialog
          title={action.type === 'confirm' ? 'Confermi la ricezione?' : "Annullare l'ordine?"}
          text={dialogText(action)} confirmLabel={action.type === 'confirm' ? 'Ricevuto' : 'Annulla ordine'}
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
