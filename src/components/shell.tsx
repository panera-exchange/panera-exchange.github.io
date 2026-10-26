import { Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { usePathname, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { fonts } from '@/theme'
import { BalanceChip, Btn } from '@/components/ui'
import { OnlineBadge } from '@/components/online-badge'

// Logo PanEx: "Pan" verde, "Ex" giallo, ombra nera piena.
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <Text style={{ fontFamily: fonts.title, fontSize: size, textShadowColor: '#000', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 }}>
      <Text style={{ color: '#7ed348' }}>Pan</Text>
      <Text style={{ color: '#f7c82b' }}>Ex</Text>
    </Text>
  )
}

// Pulsante delle regole del mercato: color diamante, acceso quando la pagina è aperta.
function RulesButton() {
  const path = usePathname()
  const router = useRouter()
  const active = path === '/regole'
  return (
    <Btn title="Regole" variant="nav" color={active ? '#2fa7ad' : '#1d5e63'} active={active}
      onPress={() => router.navigate('/regole')} />
  )
}

// Intestazione: logo, regole, utente, saldo e pulsante Esci.
export function AppHeader() {
  const { username } = useSession()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const narrow = width < 700
  const name = !!username && <Text style={{ fontFamily: fonts.body, fontSize: 21, color: '#c8c8c8' }}>{username}</Text>
  const balanceAndExit = (
    <>
      <BalanceChip />
      <Btn title="Esci" variant="alt" onPress={() => supabase.auth.signOut()} />
    </>
  )
  return (
    <View style={{ backgroundColor: '#3a3a3a', borderBottomWidth: 4, borderBottomColor: '#000', paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 980, alignSelf: 'center', flexDirection: 'row', alignItems: narrow ? 'flex-start' : 'center',
        justifyContent: 'space-between', flexWrap: narrow ? 'nowrap' : 'wrap', gap: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
        {/* Su telefono le regole vanno sotto il logo, perché a destra lo spazio è già pieno. */}
        <View style={{ alignItems: 'flex-start', gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image
              source={require('@/assets/images/logo.gif')}
              style={{ width: 56, height: 56 }}
              contentFit="contain"
              accessibilityLabel="Logo PanEx"
            />
            <View>
              <Logo />
              <Text style={{ fontFamily: fonts.body, fontSize: 18, color: '#c8c8c8', marginTop: 2 }}>Panera Exchange</Text>
            </View>
          </View>
          {narrow && <RulesButton />}
        </View>
        {/* Su telefono: saldo ed Esci, poi il nome, poi chi è online, tutto allineato a destra. */}
        <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!narrow && <RulesButton />}
            {!narrow && name}
            {balanceAndExit}
          </View>
          {narrow && name}
          <OnlineBadge />
        </View>
      </View>
    </View>
  )
}

// Ogni scheda ha il suo colore: scuro quando non è selezionata, acceso quando lo è.
// Offerte e Richieste sono le principali: al centro e più grandi.
const TABS = [
  { href: '/', label: 'Home', dark: '#3d4651', light: '#6b7a8c', main: false },
  { href: '/ordini', label: 'Ordini', dark: '#203a66', light: '#3a6cc0', main: false },
  { href: '/offerte', label: 'Offerte', dark: '#1f5a33', light: '#3aa35c', main: true },
  { href: '/richieste', label: 'Richieste', dark: '#6b4f0c', light: '#c9971c', main: true },
  { href: '/movimenti', label: 'Movimenti', dark: '#6a3517', light: '#c0662b', main: false },
  { href: '/andamento', label: 'Andamento', dark: '#43275f', light: '#8150b8', main: false },
] as const

// Navigazione: in alto su schermi larghi, in basso su telefono.
export function Nav({ bottom }: { bottom?: boolean }) {
  const path = usePathname()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // Su telefono le due principali hanno una riga tutta loro, sopra le altre quattro.
  const tabs = bottom ? [...TABS.filter((x) => x.main), ...TABS.filter((x) => !x.main)] : TABS
  const buttons = tabs.map((tab) => {
    const active = path === tab.href
    return (
      <View key={tab.href} style={bottom ? { width: tab.main ? '50%' : '25%', padding: 3 } : undefined}>
        <Btn title={tab.label} accessibilityLabel={tab.label} variant="nav" color={active ? tab.light : tab.dark}
          full={bottom} compact={bottom && !tab.main} big={tab.main} active={active} onPress={() => router.navigate(tab.href)} />
      </View>
    )
  })
  if (bottom) return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#3a3a3a',
      borderTopWidth: 4, borderTopColor: '#000', padding: 5, paddingBottom: 5 + insets.bottom }}>
      {buttons}
    </View>
  )
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
      {buttons}
    </View>
  )
}

// Firma dell'autore: una riga grigia e discreta, senza link.
// In VT323 sono circa 190px, quindi sta su una riga anche sui telefoni più stretti.
export function Signature() {
  return (
    <Text style={{ fontFamily: fonts.body, fontSize: 17, color: '#a8a8a8', textAlign: 'center' }}>
      © 2026 Marco Solime · Tokyo
    </Text>
  )
}

// Barra a piè di pagina con la firma, stessa grafica dell'intestazione.
export function Footer() {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ backgroundColor: '#3a3a3a', borderTopWidth: 4, borderTopColor: '#000', paddingTop: 5, paddingHorizontal: 8, paddingBottom: 5 + insets.bottom }}>
      <Signature />
    </View>
  )
}
