import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { fonts, useTheme } from '@/theme'
import { Btn, Card, Txt } from '@/components/ui'
import { TopNav, pageContent } from '@/components/shell'

const PROTOCOLLO_URL = 'https://panera-exchange.github.io/protocollo_BCP.pdf'

// Testo provvisorio, ripreso dal regolamento di PanEx 1.0: alcuni articoli (es. 02 e 03) vanno ancora rivisti.
const ARTICLES = [
  {
    title: 'Username riconoscibili',
    body: 'Gli utenti devono usare il proprio username Minecraft reale, riconoscibile dagli altri giocatori del server. Non sono ammessi nickname falsi o anonimi.',
  },
  {
    title: 'Nomi speciali degli oggetti',
    body: 'I nomi degli oggetti messi in vendita corrisondono ai nomi ufficiali trovati in gioco. Nel caso il nome non soddisfi la creativitá dell\'utente, il riquadro note serve per specificare se siano presenti enchantment o se l\'oggetto da vendere sia personalizzato.',
  },
  
  {
    title: 'Valuta ufficiale e tasso di cambio',
    body: 'Tutti i prezzi devono essere espressi in Tosi, al tasso di cambio diamante–tosi stabilito e pubblicato dalla Banca Centrale di Panera (BCP). Non sono ammesse valutazioni parallele, baratti diretti in diamanti o prezzi che ignorino il tasso ufficiale in vigore.',
  },
  {
    title: 'Consegne',
    body: 'All\'acquisto di un oggetto i soldi del compratore vengono prelevati istantaneamente. Il venditore è notificato dell\'ordine e deve consegnare l\'oggetto presso la cassa dell\'acquirente situata al primo piano dell\'UNIVERMAG di Brasimogne Est. Successivamente segnala l\'avvenuta consegna tramite la schermata "Ordini", l\'acquirente allora dovrá confermare l\'avvenuta consegna tramite la medesima pagina e il pagamento sará depositato sul conto del venditore. Per un economia funzionale si prega di completare questi passi nella maniera più celere possibile.',
  },
  {
    title: 'Depositi e prelievi di diamanti',
    body: 'I diamanti non possono essere scambiati direttamente sul mercato. Ogni deposito o prelievo deve avvenire esclusivamente tramite la procedura ufficiale della BCP presso la propria sede in Brasimogne Est, previo avviso alla Presidenza della BCP e con relativa registrazione nel libro mastro e rilascio del libretto sigillato come prova della transazione.',
  },
  {
    title: 'Prezzi onesti',
    body: 'Si raccomanda di proporre prezzi equi e in linea con il mercato del server. Speculazioni eccessive o annunci in malafede possono essere segnalati agli admin.',
  },
]

// Regolamento del mercato: intestazione col sigillo BCP, articoli numerati e avvertenza finale.
export default function Regole() {
  const t = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pageContent}>
        <TopNav />
        <View style={s.heading}>
          <View style={s.seal}>
            <View style={s.sealInner}>
              <Text style={s.sealText}>BCP</Text>
            </View>
          </View>
          <Txt variant="muted" style={s.kicker}>Banca Centrale di Panera · Mercato Unico di Panera</Txt>
          <View style={s.row}>
            <Image source={require('@/assets/images/enchanted_book.png')} style={s.book} contentFit="contain" />
            <Txt variant="title" style={s.title}>Regolamento del Mercato</Txt>
          </View>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            In conformità al Protocollo sullo Statuto della Banca Centrale di Panera. Il mercato opera sotto la
            supervisione della BCP per quanto attiene alla valuta e al tasso di cambio.
          </Txt>
          <Btn title="Protocollo BCP (PDF)" onPress={() => Linking.openURL(PROTOCOLLO_URL)} />
        </View>

        {ARTICLES.map((a, i) => (
          <Card key={a.title} style={[s.article, { borderLeftColor: '#3aa35c' }]}>
            <View style={[s.number, { borderRightColor: t.soft }]}>
              <Txt variant="muted" style={{ fontSize: 18, lineHeight: 20 }}>ART.</Txt>
              <Txt variant="price" style={s.numberText}>{String(i + 1).padStart(2, '0')}</Txt>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Txt variant="title" style={{ color: t.pos }}>{a.title.toUpperCase()}</Txt>
              <Txt>{a.body}</Txt>
            </View>
          </Card>
        ))}

        <Card style={{ borderColor: t.red }}>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            Il mancato rispetto del presente regolamento può comportare la rimozione degli annunci o il ban dal
            mercato da parte degli amministratori del server.
          </Txt>
        </Card>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  heading: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  // Sigillo a blocco, con il bordo in rilievo come i bottoni.
  seal: { borderWidth: 3, borderColor: '#000', boxShadow: '0 0 18px rgba(242, 183, 5, 0.55)' },
  sealInner: {
    width: 76, height: 76, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f5a33', borderWidth: 4,
    borderTopColor: 'rgba(255,255,255,0.35)', borderLeftColor: 'rgba(255,255,255,0.35)', borderBottomColor: 'rgba(0,0,0,0.35)', borderRightColor: 'rgba(0,0,0,0.35)',
  },
  sealText: { fontFamily: fonts.title, fontSize: 16, color: '#f2c94c', textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  kicker: { fontSize: 18, letterSpacing: 2, textAlign: 'center', textTransform: 'uppercase' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center' },
  book: { width: 32, height: 32 },
  title: { fontSize: 16, lineHeight: 26, textAlign: 'center' },
  article: { flexDirection: 'row', gap: 12, borderLeftWidth: 8 },
  number: { width: 52, alignItems: 'center', borderRightWidth: 3, paddingRight: 10 },
  numberText: { fontFamily: fonts.title, fontSize: 18, lineHeight: 28 },
})
