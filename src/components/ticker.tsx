import { useEffect, useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { fonts } from '@/theme'
import { TosiIcon, fmt } from '@/components/ui'

type Row = { id: string; kind: 'offer' | 'request'; quantity: number; unit_price: string; items: { name: string } | null }

const SPEED = 60 // velocità di scorrimento, in pixel al secondo

// Striscia in cima alla pagina con tutti gli annunci aperti, che scorre all'infinito come nel PanEx vecchio.
export function Ticker() {
  const { width: screen } = useWindowDimensions()
  const [rows, setRows] = useState<Row[]>([])
  const [width, setWidth] = useState(0)
  const x = useSharedValue(0)

  // Annunci aperti, ricaricati ogni minuto.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('listings')
        .select('id, kind, quantity, unit_price::text, items(name)')
        .eq('status', 'open').order('created_at', { ascending: false }).limit(50)
      if (!cancelled && data) setRows(data as unknown as Row[])
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  // Scorre di una copia intera e ricomincia: le copie sono identiche, quindi il salto non si vede.
  useEffect(() => {
    if (!width) return
    x.set(0)
    x.set(withRepeat(withTiming(-width, { duration: (width / SPEED) * 1000, easing: Easing.linear }), -1, false))
    return () => cancelAnimation(x)
  }, [width, x])

  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }))

  // Abbastanza copie da riempire sempre lo schermo, anche con pochi annunci.
  const copies = width ? Math.max(2, Math.ceil(screen / width) + 1) : 2

  const strip = (copy: number) => (
    <View key={copy} style={s.strip}
      onLayout={copy === 0 ? (e) => setWidth(e.nativeEvent.layout.width) : undefined}>
      {rows.length === 0
        ? <Text style={[s.text, s.item, { color: '#cccccc' }]}>Nessun annuncio attivo</Text>
        : rows.map((r) => {
          const color = r.kind === 'offer' ? '#7ed348' : '#f2b705'
          return (
            <View key={r.id} style={[s.strip, s.item]}>
              <Text style={[s.text, { color }]}>{r.kind === 'offer' ? '▲' : '▼'}</Text>
              <Text style={[s.text, { color: '#cccccc' }]}>
                {r.items?.name ?? '?'} ×{fmt(r.quantity)}
              </Text>
              <Text style={[s.text, { color }]}>{fmt(r.unit_price)}</Text>
              <TosiIcon size={24} />
            </View>
          )
        })}
    </View>
  )

  return (
    <View style={s.bar}>
      <Animated.View style={[s.strip, { alignSelf: 'flex-start' }, moving]}>
        {Array.from({ length: copies }, (_, i) => strip(i))}
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  bar: { height: 30, justifyContent: 'center', overflow: 'hidden', backgroundColor: '#0d1a0d', borderBottomWidth: 2, borderBottomColor: '#1a3a1a' },
  strip: { flexDirection: 'row', alignItems: 'center' },
  item: { gap: 5, marginRight: 32 },
  text: { fontFamily: fonts.body, fontSize: 20 },
})