export const lightColors = {
  background: '#F3F7F7', surface: '#FFFFFF', surfaceMuted: '#E8EEEE', text: '#182426',
  textMuted: '#59696C', textDisabled: '#899597', primary: '#0F766E', onPrimary: '#FFFFFF',
  primarySurface: '#DCEFED', onPrimarySurface: '#075F59', border: '#DCE5E6', borderStrong: '#AEBDBF',
  danger: '#B42318', onDanger: '#FFFFFF', dangerSurface: '#FEE4E2', success: '#16794D',
  successSurface: '#DDF3E8', warning: '#8A4B08', warningSurface: '#FFF0CF', scrim: '#00000066',
} as const

export const darkColors: { readonly [Key in keyof typeof lightColors]: string } = {
  background: '#121A1C', surface: '#1A2527', surfaceMuted: '#233033', text: '#EEF5F6',
  textMuted: '#A8B5B7', textDisabled: '#738184', primary: '#72CEC5', onPrimary: '#102D2A',
  primarySurface: '#193B39', onPrimarySurface: '#8BE0D7', border: '#314144', borderStrong: '#516266',
  danger: '#FDA29B', onDanger: '#3B0A07', dangerSurface: '#4A1D1A', success: '#75D8A7',
  successSurface: '#173D2C', warning: '#F8C66A', warningSurface: '#443115', scrim: '#00000099',
}

export type SemanticColors = typeof lightColors | typeof darkColors
