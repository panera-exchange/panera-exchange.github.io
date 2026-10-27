import { Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { usePathname, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { useOrderAlerts } from '@/lib/order-alerts'
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
              style={{ width: 58, height: 58 }}
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
  const { todo } = useOrderAlerts()
  // Su telefono le due principali hanno una riga tutta loro, sopra le altre quattro:
  // dimensione normale invece di "big", ma comunque più grandi delle altre (che sono compatte).
  const tabs = bottom ? [...TABS.filter((x) => x.main), ...TABS.filter((x) => !x.main)] : TABS
  const buttons = tabs.map((tab) => {
    const active = path === tab.href
    return (
      <View key={tab.href} style={bottom ? { width: tab.main ? '50%' : '25%', padding: 3 } : undefined}>
        <Btn title={tab.label} accessibilityLabel={tab.label} variant="nav" color={active ? tab.light : tab.dark}
          full={bottom} compact={bottom && !tab.main} big={tab.main && !bottom} active={active} onPress={() => router.navigate(tab.href)} />
        {/* Ordini che aspettano una mia azione: da consegnare o da ritirare. */}
        {tab.href === '/ordini' && todo > 0 && (
          <View pointerEvents="none" style={{ position: 'absolute', top: bottom ? -4 : -10, right: bottom ? -2 : -10, minWidth: 24, height: 24,
            paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e02020', borderWidth: 2, borderColor: '#000' }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 18, lineHeight: 20, color: '#fff' }}>{todo > 99 ? '99+' : todo}</Text>
          </View>
        )}
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      {buttons}
    </View>
  )
}

// Contenuto scorrevole di ogni pagina: lo scroll occupa tutta la finestra (così la rotella funziona
// anche ai lati), mentre il contenuto resta centrato e largo al massimo 980.
export const pageContent = { padding: 14, gap: 14, width: '100%', maxWidth: 980, alignSelf: 'center' } as const

// Menu su schermi larghi: va messo in cima al contenuto scorrevole di ogni pagina,
// così scorre via con la pagina mentre l'intestazione resta fissa. Su telefono c'è la barra in basso.
export function TopNav() {
  const { width } = useWindowDimensions()
  return width >= 700 ? <Nav /> : null
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
