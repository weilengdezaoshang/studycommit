import { useEffect, useState } from 'react'
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
import { requestPhoneCode, verifyPhoneLogin } from './auth-api'

export function AuthFlow() {
  const insets = useSafeAreaInsets()
  const theme = useAppTheme()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [codeSending, setCodeSending] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [resendLeft, setResendLeft] = useState(0)

  useEffect(() => {
    if (resendLeft <= 0) {
      return undefined
    }
    const timer = setInterval(() => setResendLeft((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendLeft])

  const phoneValid = /^1\d{10}$/.test(phone)

  const requestCode = async () => {
    setCodeSending(true)
    setError(null)
    try {
      await requestPhoneCode(phone)
      setResendLeft(60)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '验证码发送失败')
    } finally {
      setCodeSending(false)
    }
  }

  const login = async () => {
    setLoggingIn(true)
    setError(null)
    try {
      await verifyPhoneLogin(phone, code)
    } catch (requestError) {
      setCode('')
      setError(requestError instanceof Error ? requestError.message : '登录失败')
    } finally {
      setLoggingIn(false)
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
        <Text style={styles.headline}>登录 StudyCommit</Text>
        <Text style={styles.subline}>继续整理你的学习记录</Text>

        <TextInput
          style={styles.phoneInput}
          keyboardType="number-pad"
          maxLength={11}
          placeholder="手机号"
          placeholderTextColor={paperColors.mutedFaint}
          value={phone}
          onChangeText={(value) => setPhone(value.replace(/\D/g, ''))}
        />
        <View style={styles.codeRow}>
          <TextInput
            style={[styles.phoneInput, styles.codeInput]}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="验证码"
            placeholderTextColor={paperColors.mutedFaint}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="获取验证码"
            disabled={!phoneValid || resendLeft > 0 || codeSending}
            onPress={() => void requestCode()}
            style={[
              styles.codeButton,
              (!phoneValid || resendLeft > 0 || codeSending) && styles.codeButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.codeButtonText,
                (!phoneValid || resendLeft > 0 || codeSending) && styles.codeButtonTextDisabled,
              ]}
            >
              {codeSending ? '发送中' : resendLeft > 0 ? `${resendLeft}s 后重发` : '获取验证码'}
            </Text>
          </Pressable>
        </View>

        {error && (
          <Text role="alert" style={[styles.errorText, { color: theme.colors.danger }]}>
            {error}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="登录"
          disabled={!phoneValid || code.length !== 6 || loggingIn}
          onPress={() => void login()}
          style={[
            styles.loginButton,
            (!phoneValid || code.length !== 6 || loggingIn) && styles.loginButtonDisabled,
          ]}
        >
          <Text style={styles.loginButtonText}>{loggingIn ? '登录中' : '登录'}</Text>
        </Pressable>

        <Text style={styles.hint}>首次验证将自动创建 StudyCommit 账户</Text>
        <Text style={styles.agreement}>登录即代表你同意《用户协议》和《隐私政策》</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperColors.paper },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  headline: { color: paperColors.ink, fontSize: 26, fontWeight: '700' },
  subline: { color: paperColors.muted, fontSize: 14, marginTop: 8, marginBottom: 32 },
  phoneInput: {
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
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  codeInput: { flex: 1, marginBottom: 0 },
  codeButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: paperColors.actionSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeButtonDisabled: { opacity: 0.5 },
  codeButtonText: { color: paperColors.action, fontSize: 12 },
  codeButtonTextDisabled: { color: paperColors.mutedFaint },
  errorText: { fontSize: 12, marginBottom: 8 },
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
