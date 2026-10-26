import { ActivityIndicator, View, useWindowDimensions } from 'react-native'
import { Redirect, Slot } from 'expo-router'
import { useSession } from '@/lib/session'
import { PresenceProvider } from '@/lib/presence'
import { useTheme } from '@/theme'
import { AppHeader, Nav } from '@/components/shell'
import { Ticker } from '@/components/ticker'

// Area riservata: senza accesso si torna al login. Intestazione e navigazione sono nostre, come nel prototipo.
// Su schermi larghi il menu sta dentro ogni pagina (TopNav) e scorre con il contenuto.
export default function AppLayout() {
  const { session, loading } = useSession()
  const t = useTheme()
  const { width } = useWindowDimensions()
  if (loading) return <View style={{ flex: 1, backgroundColor: t.bg }}><ActivityIndicator style={{ marginTop: 80 }} /></View>
  if (!session) return <Redirect href="/login" />

  const wide = width >= 700
  return (
    <PresenceProvider>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <AppHeader />
        <Ticker />
        {/* A tutta larghezza: è ogni pagina a centrare il proprio contenuto (pageContent). */}
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
        {!wide && <Nav bottom />}
      </View>
    </PresenceProvider>
  )
}
