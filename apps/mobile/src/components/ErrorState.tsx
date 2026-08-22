import { Image, StyleSheet, View } from 'react-native'
import studyErrorIllustration from '../../assets/study-error-illustration.png'
import { useAppTheme } from '../theme/ThemeProvider'
import { AppText } from './AppText'
import { Button } from './Button'

export type ErrorStateProps = {
  description: string
  onRetry?: () => void
  retrying?: boolean
  title: string
}

export function ErrorState({ description, onRetry, retrying, title }: ErrorStateProps) {
  const theme = useAppTheme()
  return (
    <View
      accessible
      accessibilityRole="alert"
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          shadowColor: theme.colors.text,
        },
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel="暂时无法加载内容的插画"
        source={studyErrorIllustration}
        style={styles.illustration}
      />
      <AppText variant="subheading" weight="semibold" style={styles.title}>
        {title}
      </AppText>
      <AppText color="muted" variant="bodySmall" style={styles.description}>
        {description}
      </AppText>
      {onRetry ? (
        <View style={styles.action}>
          <Button loading={retrying} onPress={onRetry}>
            重试
          </Button>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderWidth: 1,
    elevation: 2,
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  illustration: {
    height: 112,
    marginBottom: 4,
    width: 160,
  },
  title: { marginTop: 4, textAlign: 'center' },
  description: { maxWidth: 280, textAlign: 'center' },
  action: { marginTop: 8, minWidth: 112 },
})
