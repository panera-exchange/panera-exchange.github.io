import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { fonts, useTheme } from '@/theme'
import { Btn, Card, Txt } from '@/components/ui'
import { TopNav, pageContent } from '@/components/shell'

const PROTOCOLLO_URL = 'https://panera-exchange.github.io/Protocollo_BCP.pdf'

// Testo provvisorio, ripreso dal regolamento di PanEx 1.0: alcuni articoli (es. 02 e 03) vanno ancora rivisti.
const ARTICLES = [
  {
    title: 'Username riconoscibili',
    body: 'Gli utenti devono usare il proprio username Minecraft reale, riconoscibile dagli altri giocatori del server. Non sono ammessi nickname falsi o anonimi.',
  },
  {
    title: 'Nomi speciali degli oggetti',
    body: 'I nomi degli oggetti messi in vendita corrispondono ai nomi ufficiali trovati in gioco. Nel caso il nome non soddisfi la creatività dell\'utente, il campo "Note" serve per specificare se siano presenti enchantment o se l\'oggetto da vendere sia personalizzato.',
  },
  {
    title: 'Valuta ufficiale e tasso di cambio',
    body: 'Tutti i prezzi devono essere espressi in Tosi, al tasso di cambio diamante–tosi stabilito e pubblicato dalla Banca Centrale di Panera (BCP). Non sono ammesse valutazioni parallele, baratti diretti in diamanti o prezzi che ignorino il tasso ufficiale in vigore.',
  },
  {
    title: 'Consegne',
    body: 'All\'acquisto di un oggetto i soldi del compratore vengono prelevati istantaneamente. Il venditore è notificato dell\'ordine e deve consegnare l\'oggetto presso la cassa dell\'acquirente situata al primo piano dell\'UNIVERMAG di Brasimogne Est. Successivamente il venditore segnala l\'avvenuta consegna nella schermata "Ordini". A quel punto l\'acquirente dovrà confermare la consegna dalla stessa schermata e il pagamento sarà depositato sul conto del venditore. Per un\'economia funzionale si prega di completare questi passi nella maniera più celere possibile.',
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

// Consigli d'uso: funzioni utili che non tutti conoscono.
const CONSIGLI = [
  {
    title: 'Rifornire gli annunci esauriti',
    body: "Un'offerta o una richiesta esaurita non sparisce: resta visibile al proprietario, in fondo alla lista, con l'etichetta “Esaurita”. Con “Rifornisci” la si riapre con nuove quantità o un nuovo prezzo, senza doverla ricreare da zero.",
  },
  {
    title: 'Modificare o ritirare un annuncio',
    body: "Prezzo, quantità e note di un annuncio si possono cambiare in qualsiasi momento con “Modifica”, e l'annuncio si toglie dalla bacheca con “Ritira”. Gli ordini già in corso su quell'annuncio restano validi.",
  },
  {
    title: 'Cercare, filtrare e ordinare',
    body: "La barra di ricerca accetta sia il nome di un item sia quello di un utente. Il menu delle categorie restringe la lista, e quello dell'ordinamento dispone gli annunci per data o per prezzo. Il prezzo è confrontato per singolo pezzo, quindi lotti e vendite a unità si confrontano in modo corretto.",
  },
  {
    title: 'Solo le mie / Eccetto le mie',
    body: "L'opzione “Solo le mie” mostra soltanto i propri annunci, compresi quelli esauriti. “Eccetto le mie” li nasconde e lascia solo quelli degli altri utenti.",
  },
  {
    title: 'Nomi degli item in inglese',
    body: "Il catalogo usa i nomi ufficiali in inglese di Minecraft: si cerca “Obsidian”, non “Ossidiana”. Bastano poche lettere per ottenere i risultati.",
  },
  {
    title: 'Vendita a lotti',
    body: "Il campo “Pezzi per lotto” stabilisce quanti pezzi formano un lotto: si possono usare le scorciatoie Stack e Chest oppure scrivere un numero. Chi compra sceglie quanti lotti prendere. Il riepilogo in fondo al modulo indica il totale dei pezzi e il prezzo per unità.",
  },
  {
    title: 'Il campo Note',
    body: "Le note servono per i dettagli che il nome non riporta, come gli incantesimi (es. “Efficiency V”) o lo stato di un oggetto.",
  },
  {
    title: 'Item introvabili: le richieste',
    body: "Se nessuno vende l'item cercato, conviene pubblicare una richiesta nella scheda Richieste, indicando il prezzo che si è disposti a pagare: chi possiede l'item potrà venderlo direttamente con “Vendi”.",
  },
  {
    title: 'Il tasto Max',
    body: "Nella finestra di acquisto o di vendita, il tasto “Max” imposta subito tutta la quantità disponibile dell'annuncio.",
  },
  {
    title: 'Il numero rosso su Ordini',
    body: "Il numero rosso sulla scheda Ordini indica quanti ordini attendono un'azione: una consegna per chi vende, un ritiro per chi compra. Nella sezione “Da fare” questi ordini compaiono sempre in cima.",
  },
  {
    title: 'Ricevuto solo dopo il ritiro',
    body: "Chi vende consegna in gioco e preme “Consegnato”, poi chi compra ritira gli item e preme “Ricevuto”. Ricevuto va premuto solo quando gli item sono stati effettivamente ritirati: a quel punto i Tosi passano al venditore e l'operazione non si può annullare.",
  },
  {
    title: 'Annullamento degli ordini',
    body: "Prima della consegna l'ordine può essere annullato sia da chi compra sia da chi vende, e i Tosi tornano al compratore. Una volta segnata la consegna, può annullare soltanto chi vende.",
  },
  {
    title: 'Tosi bloccati',
    body: "Al momento dell'acquisto i Tosi restano bloccati finché l'ordine non si chiude. La scheda Movimenti riporta sia il saldo disponibile sia l'importo bloccato negli acquisti aperti.",
  },
  {
    title: 'Controllare i prezzi prima di vendere',
    body: "La scheda Andamento riporta, per ogni item già scambiato, l'ultimo prezzo e la media pesata, insieme al prezzo di vendita più basso e alla richiesta più alta del momento. Il “?” accanto a ogni voce ne spiega il significato.",
  },
  {
    title: 'Le occasioni',
    body: "In Andamento, l'etichetta verde “Occasione” compare quando un'offerta di vendita ha un prezzo pari o inferiore a quello di una richiesta: è il momento più favorevole per comprare o vendere.",
  },
  {
    title: 'Lo storico del mercato',
    body: "Movimenti elenca tutti gli scambi conclusi sul mercato, e l'opzione “Solo i miei” li limita ai propri. Le righe blu sono voci del proprio conto, come i Tosi assegnati dagli admin o i ricalcoli dovuti a un cambio del tasso.",
  },
  {
    title: 'Cambio del tasso BCP',
    body: "Quando la BCP modifica il tasso diamante–Tosi, saldi e prezzi degli annunci vengono ricalcolati automaticamente, così da mantenere lo stesso valore in diamanti.",
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
        {/* Consigli: titolo col diamante, poi una scheda per ogni consiglio */}
        <View style={[s.heading, { marginTop: 16 }]}>
          <View style={s.row}>
            <Image source={require('@/assets/images/diamond.png')} style={s.book} contentFit="contain" />
            <Txt variant="title" style={s.title}>Consigli per usare PanEx</Txt>
          </View>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            Funzioni utili e trucchi che non tutti conoscono.
          </Txt>
        </View>

        {CONSIGLI.map((c) => (
          <Card key={c.title} style={[s.tip, { borderLeftColor: t.gold }]}>
            <Txt variant="title" style={{ color: t.coin }}>{c.title.toUpperCase()}</Txt>
            <Txt>{c.body}</Txt>
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
  tip: { gap: 6, borderLeftWidth: 8 },
})
