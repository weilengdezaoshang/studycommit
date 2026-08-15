import { useState } from 'react'
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'
import { AppText } from './AppText'

export type TextFieldProps = TextInputProps & { containerStyle?: StyleProp<ViewStyle>; error?: string; helperText?: string; label: string }

export function TextField({ containerStyle, editable = true, error, helperText, label, multiline, onBlur, onFocus, style, ...props }: TextFieldProps) {
  const theme = useAppTheme()
  const [focused, setFocused] = useState(false)
  const message = error ?? helperText
  return (
    <View style={[styles.container, containerStyle]}>
      <AppText variant="label" weight="medium">{label}</AppText>
      <TextInput
        accessibilityHint={error ?? helperText}
        accessibilityLabel={label}
        accessibilityState={{ disabled: !editable }}
        editable={editable}
        multiline={multiline}
        onBlur={(event) => { setFocused(false); onBlur?.(event) }}
        onFocus={(event) => { setFocused(true); onFocus?.(event) }}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          { backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceMuted, borderColor: error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.borderStrong, borderRadius: theme.radii.md, color: theme.colors.text, minHeight: multiline ? 96 : theme.sizes.controlHeight, opacity: editable ? 1 : theme.motion.disabledOpacity },
          multiline && styles.multiline,
          style,
        ]}
        {...props}
      />
      {message ? <AppText accessibilityRole={error ? 'alert' : undefined} color={error ? 'danger' : 'muted'} variant="caption">{message}</AppText> : null}
    </View>
  )
}

const styles = StyleSheet.create({ container: { gap: 6 }, input: { borderWidth: 1, fontSize: 16, lineHeight: 24, paddingHorizontal: 12, paddingVertical: 10 }, multiline: { textAlignVertical: 'top' } })
