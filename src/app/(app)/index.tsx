import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { useToast } from '@/lib/toast'
import { useTheme } from '@/theme'
import { fmtDate, money } from '@/lib/format'
import { Amount, Btn, Card, Grid, Txt, fmt } from '@/components/ui'
import { TopNav, pageContent } from '@/components/shell'
import { ConfirmDialog } from '@/components/dialogs'
import { ArticleDialog, BcpDialog } from '@/components/home-dialogs'

type Article = { id: string; title: string; body: string; created_at: string; updated_at: string | null; profiles: { username: string } | null }
type Stats = { rate: string; reserve: number; exchanges: number; volume: string }

// Home: dati della Banca Centrale Panera, statistiche di PanEx e articoli degli admin.
export default function Home() {
  const { username, isAdmin } = useSession()
  const toast = useToast()
  const t = useTheme()
  const [stats, setStats] = useState<Stats | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [error, setError] = useState('')
  const [writing, setWriting] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [editingBcp, setEditingBcp] = useState(false)
  const [deleting, setDeleting] = useState<Article | null>(null)
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState('')

  const load = useCallback(async () => {
    const [settings, exch, arts] = await Promise.all([
      supabase.from('settings').select('key, value::text'),
      supabase.rpc('exchange_stats'),
      supabase.from('articles').select('id, title, body, created_at, updated_at, profiles:profiles!articles_author_id_fkey(username)').order('created_at', { ascending: false }),
    ])
    const failure = settings.error ?? exch.error ?? arts.error
    if (failure) return setError(failure.message)
    setError('')
    const map = Object.fromEntries((settings.data ?? []).map((r) => [r.key, r.value as string]))
    const e = (exch.data ?? {}) as { orders?: number; volume?: number | string }
    setStats({ rate: map.bcp_rate ?? '0', reserve: Number(map.total_reserve ?? 0), exchanges: e.orders ?? 0, volume: money(e.volume ?? '0') })
    setArticles((arts.data ?? []) as unknown as Article[])
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function removeArticle() {
    if (!deleting) return
    setDelBusy(true)
    setDelErr('')
    const { error } = await supabase.rpc('delete_article', { p_article_id: deleting.id })
    setDelBusy(false)
    if (error) return setDelErr(error.message)
    setDeleting(null)
    toast('Articolo eliminato.')
    load()
  }

  const cards = stats && [
    { key: 'rate', node: (
      <Card>
        <Txt variant="muted">Tasso di cambio BCP</Txt>
        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Txt variant="price" style={{ fontSize: 28, lineHeight: 32 }}>1</Txt>
          <Image source={require('@/assets/images/diamond.png')}
            style={{ width: 35, height: 35 }}
            contentFit="contain" accessibilityLabel="Diamante" />
          <Amount variant="price" style={{ fontSize: 28, lineHeight: 32 }}>= {fmt(stats.rate)}</Amount>
        </View>
      </Card>
    ) },
    { key: 'reserve', node: (
      <Card>
        <Txt variant="muted">Riserva totale</Txt>
        <View style={s.row}>
          <Txt style={{ fontSize: 34, lineHeight: 40 }}>{fmt(stats.reserve)}</Txt>
          <Image source={require('@/assets/images/diamond.png')} style={s.itemIcon} contentFit="contain" />
        </View>
        <Txt variant="muted">diamanti</Txt>
      </Card>
    ) },
    { key: 'exchanges', node: (
      <Card>
        <Txt variant="muted">Scambi totali</Txt>
        <Txt style={{ fontSize: 34, lineHeight: 40 }}>{fmt(stats.exchanges)}</Txt>
        <Amount variant="muted" after="scambiati">{fmt(stats.volume)}</Amount>
      </Card>
    ) },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pageContent}>
        <TopNav />
        <Txt variant="muted">Benvenuto{username ? `, ${username}` : ''}. Qui trovi i dati della Banca Centrale Panera e le novità.</Txt>
        {!!error && <Txt variant="error">{error}</Txt>}
        {cards && <Grid data={cards} keyOf={(c) => c.key} render={(c) => c.node} />}
        {isAdmin && stats && (
          <View style={s.row}><Btn title="Modifica dati BCP" variant="alt" onPress={() => setEditingBcp(true)} /></View>
        )}

        <View style={[s.row, { justifyContent: 'space-between', marginTop: 8 }]}>
          <Txt variant="title">Articoli</Txt>
          {isAdmin && <Btn title="+ Nuovo articolo" onPress={() => setWriting(true)} />}
        </View>
        {articles.length === 0 && <Txt variant="muted">Nessun articolo pubblicato.</Txt>}
        {articles.map((a) => (
          <Card key={a.id} style={{ gap: 6 }}>
            <View style={s.row}>
              <Image source={require('../../../assets/images/enchanted_book.png')} style={s.itemIcon} contentFit="contain" />
              <Txt variant="title" style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 22 }}>{a.title}</Txt>
            </View>
            {a.updated_at && <Txt variant="muted">modificato il {fmtDate(a.updated_at)}</Txt>}
            <Txt variant="muted">di {a.profiles?.username ?? '?'} · {fmtDate(a.created_at)}</Txt>
            <Txt style={{ marginTop: 4 }}>{a.body}</Txt>
            {isAdmin && (
              <View style={[s.row, { marginTop: 6 }]}>
                <Btn title="Modifica" variant="alt" onPress={() => setEditingArticle(a)} />
                <Btn title="Elimina" variant="danger" onPress={() => { setDelErr(''); setDeleting(a) }} />
              </View>
            )}
          </Card>
        ))}
      </ScrollView>

      {writing && <ArticleDialog onClose={() => setWriting(false)} onDone={(m) => { setWriting(false); toast(m); load() }} />}
      {editingArticle && <ArticleDialog key={editingArticle.id} article={editingArticle} onClose={() => setEditingArticle(null)}
        onDone={(m) => { setEditingArticle(null); toast(m); load() }} />}
      {editingBcp && stats && (
        <BcpDialog rate={stats.rate} reserve={stats.reserve} onClose={() => setEditingBcp(false)}
          onDone={(m) => { setEditingBcp(false); toast(m); load() }} />
      )}
      {deleting && (
        <ConfirmDialog title="Eliminare l'articolo?" danger confirmLabel="Elimina" busy={delBusy} error={delErr}
          text={`"${deleting.title}" sparirà per tutti gli utenti.`} onConfirm={removeArticle} onClose={() => setDeleting(null)} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  itemIcon: { width: 32, height: 32 },
})
