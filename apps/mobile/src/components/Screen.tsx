import type { PropsWithChildren } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '../theme/ThemeProvider'

type ScreenProps = PropsWithChildren<{
  includeBottomInset?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}>

export function Screen({ children, includeBottomInset = true, style, testID }: ScreenProps) {
  const insets = useSafeAreaInsets()
  const theme = useAppTheme()

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
          paddingBottom: includeBottomInset ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
