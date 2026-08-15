import { Pressable, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAppTheme } from '../theme/ThemeProvider'
import { AppText } from './AppText'

export function AppHeaderAvatar() {
  const navigation = useNavigation()
  const theme = useAppTheme()

  return (
    <Pressable
      accessibilityHint="进入账户和设置页面"
      accessibilityLabel="打开我的"
      accessibilityRole="button"
      hitSlop={4}
      onPress={() => navigation.navigate('Profile')}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.primarySurface,
          borderRadius: theme.radii.pill,
          opacity: pressed ? theme.motion.pressedOpacity : 1,
        },
      ]}
    >
      <AppText style={{ color: theme.colors.onPrimarySurface }} variant="label" weight="semibold">W</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
