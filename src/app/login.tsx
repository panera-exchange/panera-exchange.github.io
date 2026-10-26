import { Footer, Logo } from '@/components/shell'
import { Splash } from '@/components/splash'
import { Btn, Card, Txt } from '@/components/ui'
import { useSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import { fonts, useTheme } from '@/theme'
import { Image } from 'expo-image'
import { Redirect } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native'

export default function Login() {
  const { session } = useSession()
  const t = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Redirect href="/" />

  async function signIn() {
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message.includes('Invalid login') ? 'Email o password errate.' : error.message)
    setBusy(false)
  }

  const input = [s.input, { borderColor: t.line, backgroundColor: t.panel, color: t.ink }]
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.screen}>
      <View style={{ width: '100%', maxWidth: 380, marginBottom: 32 }}><Splash /></View>
      <Card style={{ width: '100%', maxWidth: 380, gap: 12 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Image
            source={require('@/assets/images/logo.gif')}
            style={{ width: 128, height: 128 }}
            contentFit="contain"
            accessibilityLabel="Logo PanEx"
          />
          <Logo size={20} />
        </View>
        <Txt variant="muted">Panera Exchange · accesso su invito</Txt>
        <TextInput style={input} placeholder="Email" placeholderTextColor={t.muted} autoCapitalize="none"
          keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={input} placeholder="Password" placeholderTextColor={t.muted} secureTextEntry
          value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
        <View><Btn title={busy ? 'Accesso...' : 'Accedi'} onPress={signIn} disabled={busy} /></View>
        {!!error && <Txt variant="error">{error}</Txt>}
      </Card>
    </KeyboardAvoidingView>
    <Footer />
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  input: { borderWidth: 3, paddingHorizontal: 8, paddingVertical: 6, fontFamily: fonts.body, fontSize: 22 },
})
