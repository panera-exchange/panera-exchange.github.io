import { useRef, useState, type ReactNode } from 'react'
import { Image } from 'expo-image'
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type TextProps, type ViewProps } from 'react-native'
import { fonts, useTheme } from '@/theme'
import { useSession } from '@/lib/session'
import { fmtBalance } from '@/lib/format'
import { supabase } from '@/lib/supabase'

export { fmt, fmtBalance } from '@/lib/format'

type Variant = 'body' | 'muted' | 'title' | 'price' | 'error'

export function Txt({ variant = 'body', style, ...props }: TextProps & { variant?: Variant }) {
  const t = useTheme()
  const color = variant === 'muted' ? t.muted : variant === 'price' ? t.coin : variant === 'error' ? t.red : t.ink
  const font = variant === 'title'
    ? { fontFamily: fonts.title, fontSize: 12, lineHeight: 20 }
    : { fontFamily: fonts.body, fontSize: 22, lineHeight: 26 }
  return <Text style={[{ color }, font, style]} {...props} />
}

export function Btn({ title, onPress, variant = 'primary', disabled, active, full, compact, big, color, accessibilityLabel }: {
  title: string; onPress: () => void; variant?: 'primary' | 'alt' | 'danger' | 'nav'; disabled?: boolean; active?: boolean
  full?: boolean; compact?: boolean; big?: boolean; color?: string; accessibilityLabel?: string
}) {
  const t = useTheme()
  const [hover, setHover] = useState(false)
  const bg = color ?? (variant === 'primary' ? t.green : variant === 'danger' ? t.red : variant === 'nav' ? (active ? '#3f6fb5' : '#243a5a') : t.soft)
  const glow = disabled ? 'transparent'
    : active ? `rgba(242, 183, 5, ${hover ? 1 : 0.7})`
    : /^#[0-9a-f]{6}$/i.test(bg) ? `${bg}${hover ? 'ff' : 'aa'}` : bg
  return (
    <Pressable onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [s.btnOuter, full && { alignSelf: 'stretch' },
        { borderColor: active ? t.gold : t.line, opacity: disabled ? 0.45 : 1, transform: [{ translateY: pressed ? 1 : 0 }], boxShadow: `0 0 ${hover ? 32 : 12}px ${glow}` }]}>
      <View style={[s.btn, { backgroundColor: bg }, compact && { paddingHorizontal: 2 }, big && { paddingHorizontal: 20, paddingVertical: 8 }, hover && !disabled && { filter: 'brightness(1.5)' }]}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: big ? 26 : compact ? 17 : 21, color: variant === 'alt' ? t.ink : '#fff', textAlign: 'center' }}>{title}</Text>
      </View>
    </Pressable>
  )
}

export function Card({ style, ...props }: ViewProps) {
  const t = useTheme()
  return <View style={[s.card, { backgroundColor: t.panel, borderColor: t.line }, style]} {...props} />
}

export function Badge({ text, tone = 'gold' }: { text: string; tone?: 'gold' | 'green' | 'gray' }) {
  const t = useTheme()
  const bg = tone === 'green' ? '#7ed348' : tone === 'gray' ? '#cfcfcf' : '#f2b705'
  return (
    <View style={[s.badge, { borderColor: t.line, backgroundColor: bg }]}>
      <Text style={{ fontFamily: fonts.body, fontSize: 18, color: '#262626' }}>{text}</Text>
    </View>
  )
}

export function ItemIcon({ id, size = 44 }: { id: string; size?: number }) {
  const [failedId, setFailedId] = useState<string | null>(null)
  const { data: { publicUrl } } = supabase.storage.from('item-icons').getPublicUrl(`icons/${id}.png`)
  return (
    <View style={{ width: size, height: size, padding: 2, backgroundColor: '#373737' }}>
      <View style={{ flex: 1, backgroundColor: '#898989', borderWidth: 2, borderColor: '#f0f0f0' }}>
        {failedId !== id && <Image source={{ uri: publicUrl }} style={{ width: '100%', height: '100%' }}
          contentFit="contain" cachePolicy="memory-disk" onError={() => setFailedId(id)} />}
      </View>
    </View>
  )
}

// Moneta Tosi. Abbassata un po' per allinearla alle lettere del font VT323.
export function TosiIcon({ size = 20 }: { size?: number }) {
  return (
    <Image source={require('@/assets/images/tosi.png')}
      style={{ width: size, height: size, transform: [{ translateY: Math.round(size * 0.05) }] }}
      contentFit="contain" accessibilityLabel="Tosi" />
  )
}

// Importo in Tosi: testo, moneta, e un testo facoltativo dopo (es. "/ unità").
// La moneta è grande in proporzione al testo, se non si indica iconSize.
export function Amount({ children, after, iconSize, ...props }:
  TextProps & { variant?: Variant; iconSize?: number; after?: string }) {
  const fontSize = StyleSheet.flatten(props.style)?.fontSize ?? 22
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <Txt {...props}>{children}</Txt>
      <TosiIcon size={iconSize ?? Math.round(fontSize * 2.25)} />
      {!!after && <Txt {...props}>{after}</Txt>}
    </View>
  )
}

export function BalanceChip() {
  const { balance } = useSession()
  return (
    <View style={s.chip}>
      <TosiIcon size={32} />
      <Text style={{ fontFamily: fonts.body, fontSize: 24, color: '#fff' }}>
        {balance === null ? '...' : fmtBalance(balance)}
      </Text>
    </View>
  )
}

export function Checkbox({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme()
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="checkbox" accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 26, height: 26, borderWidth: 3, borderColor: t.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        {value && <Text style={{ color: '#262626', fontSize: 20, lineHeight: 22 }}>✓</Text>}
      </View>
      <Txt>{label}</Txt>
    </Pressable>
  )
}

// Menu a tendina semplice: l'elenco si apre sotto il campo.
export function Select<T extends string>({ value, options, onChange, width }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; width?: number
}) {
  const t = useTheme()
  const anchorRef = useRef<View>(null)
  const [anchor, setAnchor] = useState<{ x: number; top: number; width: number } | null>(null)
  const box = [s.select, { borderColor: t.line, backgroundColor: t.panel }]

  function toggle() {
    if (anchor) return setAnchor(null)
    anchorRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, top: y + height, width }))
  }

  return (
    <View ref={anchorRef} collapsable={false} style={{ width, minWidth: width ?? 200 }}>
      <Pressable onPress={toggle} style={box}>
        <Txt>{options.find((o) => o.value === value)?.label}</Txt>
        <Txt>{anchor ? '⌃' : '⌄'}</Txt>
      </Pressable>
      {anchor && (
        <Modal transparent statusBarTranslucent animationType="none" onRequestClose={() => setAnchor(null)}>
          <View style={{ flex: 1 }}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnchor(null)} />
            <View style={[s.selectMenu, { left: anchor.x, top: anchor.top, width: anchor.width }]}>
              {options.map((o) => (
                <Pressable key={o.value} onPress={() => { onChange(o.value); setAnchor(null) }} style={[box, { borderTopWidth: 0 }]}>
                  <Txt>{o.label}</Txt>
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

// Numero di colonne in base alla larghezza (schede da almeno 260 punti, massimo 980 di contenuto).
export function useColumns() {
  const { width } = useWindowDimensions()
  const available = Math.min(width, 980) - 28
  return Math.max(1, Math.floor((available + 16) / 276))
}

export function Grid<T>({ data, keyOf, render }: { data: T[]; keyOf: (d: T) => string; render: (d: T) => ReactNode }) {
  const cols = useColumns()
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 }}>
      {data.map((d) => (
        <View key={keyOf(d)} style={{ width: `${100 / cols}%`, padding: 8 }}>{render(d)}</View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  btnOuter: { borderWidth: 3 },
  btn: { paddingHorizontal: 12, paddingVertical: 4, borderWidth: 3, borderTopColor: 'rgba(255,255,255,0.35)', borderLeftColor: 'rgba(255,255,255,0.35)', borderBottomColor: 'rgba(0,0,0,0.35)', borderRightColor: 'rgba(0,0,0,0.35)' },
  card: { borderWidth: 3, padding: 12, boxShadow: '4px 4px 0px #000' },
  badge: { alignSelf: 'flex-start', borderWidth: 2, paddingHorizontal: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#262626', borderWidth: 3, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 2 },
  select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 3, paddingHorizontal: 8, paddingVertical: 4 },
  selectMenu: { position: 'absolute', elevation: 8 },
})
