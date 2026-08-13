import { Pressable, StyleSheet, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAppTheme } from '../theme/ThemeProvider'

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
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.onPrimarySurface }]}>W</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
})
