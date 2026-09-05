import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '../../theme/ThemeProvider'
import { paperColors } from '../papers/paper-visual'
import { loginWithAccount, registerAccount } from './auth-api'

export function AuthFlow() {
  const insets = useSafeAreaInsets()
  const theme = useAppTheme()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [account, setAccount] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const accountValid = account.trim().length >= 2
  const nicknameValid =
    mode === 'login' || (nickname.trim().length >= 2 && nickname.trim().length <= 30)
  const passwordValid = password.length >= 8
  const confirmValid = mode === 'login' || password === confirmPassword
  const agreementValid = mode === 'login' || agreed
  const canSubmit =
    accountValid && nicknameValid && passwordValid && confirmValid && agreementValid && !submitting

  const switchMode = (next: 'login' | 'register') => {
    setMode(next)
    setError(null)
    setNotice(null)
    setNickname('')
    setPassword('')
    setConfirmPassword('')
    setAgreed(false)
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致')
          return
        }
        if (!agreed) {
          setError('请先勾选同意《用户协议》和《隐私政策》')
          return
        }
        await registerAccount(account.trim(), password, nickname.trim())
        setMode('login')
        setNickname('')
        setPassword('')
        setConfirmPassword('')
        setAgreed(false)
        setNotice('注册成功，请登录')
        return
      }
      await loginWithAccount(account.trim(), password)
    } catch (requestError) {
      setPassword('')
      setConfirmPassword('')
      setError(
        requestError instanceof Error
          ? requestError.message
          : mode === 'register'
            ? '注册失败'
            : '登录失败',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={styles.headline}>
          {mode === 'login' ? '登录 StudyCommit' : '注册 StudyCommit'}
        </Text>
        <Text style={styles.subline}>
          {mode === 'login' ? '继续整理你的学习记录' : '先创建账号，再使用账号登录'}
        </Text>

        <TextInput
          style={styles.field}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={32}
          placeholder="账号"
          placeholderTextColor={paperColors.mutedFaint}
          value={account}
          onChangeText={setAccount}
        />
        <TextInput
          style={styles.field}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={128}
          placeholder="密码"
          placeholderTextColor={paperColors.mutedFaint}
          value={password}
          onChangeText={setPassword}
        />
        {mode === 'register' ? (
          <>
            <TextInput
              style={styles.field}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              placeholder="昵称（2-30 字，可选）"
              placeholderTextColor={paperColors.mutedFaint}
              value={nickname}
              onChangeText={setNickname}
            />
            <TextInput
              style={styles.field}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={128}
              placeholder="确认密码"
              placeholderTextColor={paperColors.mutedFaint}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </>
        ) : null}

        {notice ? <Text style={styles.hint}>{notice}</Text> : null}
        {error && (
          <Text role="alert" style={[styles.errorText, { color: theme.colors.danger }]}>
            {error}
          </Text>
        )}

        {mode === 'register' ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel="同意用户协议和隐私政策"
            onPress={() => setAgreed((value) => !value)}
            style={styles.agreementRow}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed ? <Ionicons name="checkmark" size={14} color={paperColors.paper} /> : null}
            </View>
            <Text style={styles.agreementCheckboxText}>
              我已阅读并同意《用户协议》和《隐私政策》
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'register' ? '注册' : '登录'}
          disabled={!canSubmit}
          onPress={() => void submit()}
          style={[styles.loginButton, !canSubmit && styles.loginButtonDisabled]}
        >
          <Text style={styles.loginButtonText}>
            {submitting
              ? mode === 'register'
                ? '注册中'
                : '登录中'
              : mode === 'register'
                ? '注册'
                : '登录'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
        >
          <Text style={styles.hint}>
            {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
          </Text>
        </Pressable>
        <Text style={styles.agreement}>
          {mode === 'login' ? '登录' : '注册'}即代表你同意《用户协议》和《隐私政策》
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperColors.paper },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  headline: { color: paperColors.ink, fontSize: 26, fontWeight: '700' },
  subline: { color: paperColors.muted, fontSize: 14, marginTop: 8, marginBottom: 32 },
  field: {
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.line,
    backgroundColor: paperColors.surfaceSoft,
    paddingHorizontal: 14,
    color: paperColors.ink,
    fontSize: 15,
    marginBottom: 12,
  },
  errorText: { fontSize: 12, marginBottom: 8 },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    marginBottom: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.line,
    backgroundColor: paperColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: paperColors.action, borderColor: paperColors.action },
  agreementCheckboxText: { color: paperColors.muted, fontSize: 12, flex: 1 },
  loginButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: paperColors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: { opacity: 0.45 },
  loginButtonText: { color: paperColors.paper, fontSize: 15, fontWeight: '500' },
  hint: { color: paperColors.mutedFaint, fontSize: 11, marginTop: 16, textAlign: 'center' },
  agreement: { color: paperColors.mutedFaint, fontSize: 11, marginTop: 8, textAlign: 'center' },
})
