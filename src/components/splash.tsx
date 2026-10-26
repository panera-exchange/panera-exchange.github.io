import { fonts } from '@/theme'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

// Frasi buffe del server, scelte da Tinca.
const LOGIN_QUOTES = [
  'I Tosi vanno e i Tosi vengono',
  'Un Tosi nessun Tosi e centomila Tosi',
  'Lo fanno',
  "All'inizio era Panera...",
  'La Railway Company evade le tasse',
  'Free Civande',
  'Cosbrado vuol dire qualità',
  'Le talpe',
  '...anche la cenere',
  'Mossa Kansas City',
  'Pizza Icaro: metanfetamine e giare del Secchia',
  'Divertente come un affare S.E.R.',
  'I villici non provano emozioni',
  'Ayatollah cittadino di Avalon',
  'Stiano come Kim',
  'Osama Binladen fell from a high place',
  'È nera',
  'Die BDR sucht Soldaten',
  'La sicurezza sul lavoro è optional',
  'Sindacati vs Civande',
  'Novizi come i parmensi',
  'Brodo strinato afro piumato',
  'Il sole della prosperità continua a splendere su Brasimogne',
  'Glory to BDR!',
  'Per oggi ancora nessuna morte sul lavoro a Brasimogne...',
  '/execute at @Vadim8 run summon minecraft:lightning',
  'Le catene',
  'Ulrico te lo dico',
  'Tosi, vuoi entrare su Panera?',
  "Julian Assange nell'ambasciata avalonense",
  'First come, first serve',
  'Sogno ferrovie di notte',
  'Ma non è successo niente Crispo',
  'Crispo metti giorno che qua sembra la stazione di Bologna',
  'Verità per Giulio Regeni',
  'Il PIL di Panera è diminuito ancora...',
  'La BDR ti impone una pausa!',
  'Leo hit the ground too hard',
  'Tempo delle purghe a Brasimogne',
  'Niente seghe a Brasimogne',
  'Il seminario ti aspetta!',
  'La BDR ti impone di dormire, domani si lavora!',
  'Dei pocci garantiti',
  'I am the danger',
  'Si pizzica il sughero',
  'Not quite my tempo',
  'Ancient city sotto il conad di Bibbiano',
  'Sono viola',
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
    fontFamily: fonts.body, fontSize: 30, lineHeight: 34, color: '#ffff00', textAlign: 'center',
    textShadowColor: '#3f3f00', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0,
  },
})