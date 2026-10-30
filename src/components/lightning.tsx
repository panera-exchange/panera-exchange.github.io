import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AccessibilityInfo, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Easter egg "fulmine": una GIF pixel art che corre lungo il bordo dello schermo.
// La GIF è verticale; sugli schermi più larghi che alti la ruotiamo di 90°.

const LIGHTNING_GIF = require('../../assets/images/lightning-portrait-01.gif')
const LIGHTNING_MS = 12 * 70 // durata della GIF: 12 fotogrammi da 70 ms

const LightningContext = createContext<() => void>(() => {})

// Da mettere attorno alle schermate: chiunque sotto può far scoccare il fulmine con useLightning().
export function LightningProvider({ children }: { children: ReactNode }) {
  const [strikeId, setStrikeId] = useState<number | null>(null)
  const strike = useCallback(() => setStrikeId(Date.now()), [])
  const finish = useCallback(() => setStrikeId(null), [])
  return (
    <LightningContext.Provider value={strike}>
      {children}
      {strikeId !== null && <LightningOverlay key={strikeId} onFinish={finish} />}
    </LightningContext.Provider>
  )
}

export const useLightning = () => useContext(LightningContext)

function LightningOverlay({ onFinish }: { onFinish: () => void }) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [loaded, setLoaded] = useState(false)
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null)

  // Chi ha attivato "riduci movimento" nel telefono o nel computer non vede il fulmine.
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => setReduceMotion(false))
  }, [])
  useEffect(() => {
    if (reduceMotion) onFinish()
  }, [reduceMotion, onFinish])

  // Il conto alla rovescia parte quando la GIF è caricata, così si vede tutta.
  // Se per qualche motivo non si carica, dopo 3 secondi l'effetto si chiude da solo.
  useEffect(() => {
    const timer = setTimeout(onFinish, loaded ? LIGHTNING_MS : 3000)
    return () => clearTimeout(timer)
  }, [loaded, onFinish])

  if (reduceMotion !== false) return null

  // Area visibile dello schermo, senza notch e barre di sistema.
  const w = width - insets.left - insets.right
  const h = height - insets.top - insets.bottom
  const rotated = w > h

  return (
    <View pointerEvents="none" style={{ position: 'absolute', zIndex: 100, left: insets.left, top: insets.top, width: w, height: h }}>
      <Image
        source={LIGHTNING_GIF}
        contentFit="fill"
        onLoad={() => setLoaded(true)}
        style={rotated
          // Ruotata: larghezza e altezza si scambiano, poi la centriamo e la giriamo di 90°.
          ? { position: 'absolute', width: h, height: w, left: (w - h) / 2, top: (h - w) / 2, transform: [{ rotate: '90deg' }] }
          : { width: w, height: h }}
      />
    </View>
  )
}