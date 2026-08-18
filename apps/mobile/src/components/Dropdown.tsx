import { useRef, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'
import { AppText } from './AppText'

export type DropdownOption<T extends string = string> = {
  label: string
  value: T
}

export function Dropdown<T extends string>({
  disabled = false,
  error,
  hint,
  label,
  onChange,
  options,
  placeholder = '请选择',
  value,
}: {
  disabled?: boolean
  error?: string
  hint?: string
  label: string
  onChange: (value: T) => void
  options: DropdownOption<T>[]
  placeholder?: string
  value: T | ''
}) {
  const theme = useAppTheme()
  const triggerRef = useRef<View>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number } | null>(null)
  const selected = options.find((option) => option.value === value)
  const message = error ?? hint

  function closeMenu() {
    setOpen(false)
  }

  function toggleMenu() {
    if (open) {
      closeMenu()
      return
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y: y + height, width })
    })
    setOpen(true)
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="label" weight="medium">
        {label}
      </AppText>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          accessibilityHint={message}
          accessibilityLabel={label}
          accessibilityRole="combobox"
          accessibilityState={{ disabled, expanded: open }}
          accessibilityValue={{ text: selected?.label ?? placeholder }}
          disabled={disabled}
          onPress={toggleMenu}
          style={{
            alignItems: 'center',
            backgroundColor: disabled ? theme.colors.surfaceMuted : theme.colors.surface,
            borderColor: error
              ? theme.colors.danger
              : open
                ? theme.colors.primary
                : theme.colors.borderStrong,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            minHeight: theme.sizes.controlHeight,
            opacity: disabled ? theme.motion.disabledOpacity : 1,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          <AppText color={selected ? 'default' : 'muted'}>{selected?.label ?? placeholder}</AppText>
          <Ionicons
            accessibilityElementsHidden
            color={theme.colors.textMuted}
            importantForAccessibility="no-hide-descendants"
            name={open ? 'chevron-up' : 'chevron-down'}
            size={theme.sizes.iconMd}
          />
        </Pressable>
      </View>
      <Modal animationType="none" onRequestClose={closeMenu} transparent visible={open}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable
            accessibilityLabel="关闭选项"
            onPress={closeMenu}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              elevation: 8,
              left: anchor?.x ?? 16,
              maxHeight: 240,
              position: 'absolute',
              shadowColor: theme.colors.scrim,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              top: (anchor?.y ?? 80) + 4,
              width: anchor?.width,
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {options.map((option) => {
                const isSelected = option.value === value
                return (
                  <Pressable
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSelected }}
                    disabled={disabled}
                    key={option.value}
                    onPress={() => {
                      onChange(option.value)
                      closeMenu()
                    }}
                    style={{
                      backgroundColor: isSelected
                        ? theme.colors.primarySurface
                        : theme.colors.surface,
                      justifyContent: 'center',
                      minHeight: theme.sizes.touchTarget,
                      paddingHorizontal: theme.spacing.md,
                    }}
                  >
                    <AppText weight={isSelected ? 'semibold' : 'regular'}>{option.label}</AppText>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {message ? (
        <AppText
          accessibilityRole={error ? 'alert' : undefined}
          color={error ? 'danger' : 'muted'}
          variant="caption"
        >
          {message}
        </AppText>
      ) : null}
    </View>
  )
}
