import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { fonts } from '@/theme'

// Frasi buffe del server, scelte da Tinca.
const LOGIN_QUOTES = [
  'I TOSI VANNO E I TOSI VENGONO',
  'UN TOSI NESSUN TOSI E CENTOMILA TOSI',
  'LO FANNO',
  "ALL'INIZIO ERA PANERA...",
  'LA RAILWAY COMPANY EVADE LE TASSE',
  'FREE CIVANDE',
  'COSBRADO VUOL DIRE QUALITÀ',
  'LE TALPE',
  '...ANCHE LA CENERE',
  'MOSSA KANSAS CITY',
  'PIZZA ICARO: METANFETAMINE E GIARE DEL SECCHIA',
  'DIVERTENTE COME UN AFFARE S.E.R.',
  'I VILLICI NON PROVANO EMOZIONI',
  'AYATOLLAH CITTADINO DI AVALON',
  'STIANO COME KIM',
  'OSAMA BINLADEN fell from a high place',
  'È NERA',
  'DIE BDR SUCHT SOLDATEN',
  'LA SICUREZZA SUL LAVORO È OPTIONAL',
  'SINDACATI VS CIVANDE',
  'NOVIZI COME I PARMENSI',
  'BRODO STRINATO AFRO PIUMATO',
  'IL SOLE DELLA PROSPERITÀ CONTINUA A SPLENDERE SU BRASIMOGNE',
  'GLORY TO BDR!',
  'PER OGGI ANCORA NESSUNA MORTE SUL LAVORO A BRASIMOGNE...',
  '/execute at @Vadim8 run summon minecraft:lightning',
  'LE CATENE',
  'ULRICO TE LO DICO',
  'TOSI, VUOI ENTRARE SU PANERA?',
  "JULIAN ASSANGE NELL'AMBASCIATA AVALONENSE",
  'FIRST COME, FIRST SERVE',
  'SOGNO FERROVIE DI NOTTE',
  'MA NON È SUCCESSO NIENTE CRISPO',
  'CRISPO METTI GIORNO CHE QUA SEMBRA LA STAZIONE DI BOLOGNA',
  'VERITÀ PER GIULIO REGENI',
  'IL PIL DI PANERA È DIMINUITO ANCORA...',
  'LA BDR TI IMPONE UNA PAUSA!',
  'LEO HIT THE GROUND TOO HARD',
  'TEMPO DELLE PURGHE A BRASIMOGNE',
  'NIENTE SEGHE A BRASIMOGNE',
  'IL SEMINARIO TI ASPETTA!',
  'LA BDR TI IMPONE DI DORMIRE, DOMANI SI LAVORA!',
]

// Frase gialla inclinata che pulsa, come quella sotto il logo nel menu di Minecraft.
// Ne sceglie una a caso a ogni apertura della schermata.
export function Splash() {
  const [quote] = useState(() => LOGIN_QUOTES[Math.floor(Math.random() * LOGIN_QUOTES.length)])
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.set(withRepeat(withTiming(1.06, { duration: 500, easing: Easing.inOut(Easing.sin) }), -1, true))
    return () => cancelAnimation(scale)
  }, [scale])

  const pulsing = useAnimatedStyle(() => ({ transform: [{ rotate: '-4deg' }, { scale: scale.get() }] }))

  return <Animated.Text style={[s.text, pulsing]}>{quote}</Animated.Text>
}

const s = StyleSheet.create({
  text: {
    fontFamily: fonts.body, fontSize: 22, lineHeight: 24, color: '#f7c82b', textAlign: 'center',
    textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0,
  },
})
