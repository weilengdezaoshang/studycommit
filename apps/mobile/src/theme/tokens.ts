export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  smPlus: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
} as const

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const

export const typography = {
  display: { fontSize: 36, lineHeight: 44 },
  title: { fontSize: 28, lineHeight: 36 },
  heading: { fontSize: 24, lineHeight: 32 },
  subheading: { fontSize: 20, lineHeight: 28 },
  body: { fontSize: 16, lineHeight: 24 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
} as const

export const sizes = {
  touchTarget: 48,
  controlHeight: 48,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 32,
  contentMaxWidth: 640,
} as const

export const motion = {
  disabledOpacity: 0.48,
  pressedOpacity: 0.72,
  durationFast: 150,
  durationNormal: 240,
} as const

export const lightColors = {
  background: '#F3F7F7',
  surface: '#FFFFFF',
  surfaceMuted: '#E8EEEE',
  text: '#182426',
  textMuted: '#59696C',
  textDisabled: '#899597',
  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  primarySurface: '#DCEFED',
  onPrimarySurface: '#075F59',
  border: '#DCE5E6',
  borderStrong: '#AEBDBF',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  dangerSurface: '#FEE4E2',
  success: '#16794D',
  successSurface: '#DDF3E8',
  warning: '#8A4B08',
  warningSurface: '#FFF0CF',
  scrim: '#00000066',
} as const

export const darkColors = {
  background: '#121A1C',
  surface: '#1A2527',
  surfaceMuted: '#233033',
  text: '#EEF5F6',
  textMuted: '#A8B5B7',
  textDisabled: '#738184',
  primary: '#72CEC5',
  onPrimary: '#102D2A',
  primarySurface: '#193B39',
  onPrimarySurface: '#8BE0D7',
  border: '#314144',
  borderStrong: '#516266',
  danger: '#FDA29B',
  onDanger: '#3B0A07',
  dangerSurface: '#4A1D1A',
  success: '#75D8A7',
  successSurface: '#173D2C',
  warning: '#F8C66A',
  warningSurface: '#443115',
  scrim: '#00000099',
} as const
