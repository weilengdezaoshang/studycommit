import type { ComponentProps } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'

type IconName = ComponentProps<typeof Ionicons>['name']

type ScreenPlaceholderProps = {
  description: string
  icon: IconName
  title: string
}

export function ScreenPlaceholder({ description, icon, title }: ScreenPlaceholderProps) {
  const theme = useAppTheme()
  const { width } = useWindowDimensions()
  const horizontalPadding = width >= 768 ? theme.spacing.xl : theme.spacing.lg

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingHorizontal: horizontalPadding, paddingVertical: theme.spacing.xl },
      ]}
    >
      <View
        style={[
          styles.iconSurface,
          {
            backgroundColor: theme.colors.primarySurface,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <Ionicons
          accessibilityElementsHidden
          color={theme.colors.onPrimarySurface}
          importantForAccessibility="no-hide-descendants"
          name={icon}
          size={32}
        />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.description, { color: theme.colors.textMuted }]}>{description}</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSurface: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 24,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    maxWidth: 520,
    marginTop: 12,
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
  },
})
