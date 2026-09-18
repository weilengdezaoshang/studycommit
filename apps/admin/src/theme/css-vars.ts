import { mistLightColors, radii, spacing, typography } from '@studycommit/design-tokens'

export const adminCssVars: Record<string, string> = {
  '--sc-canvas': mistLightColors.background,
  '--sc-paper': mistLightColors.surface,
  '--sc-paper-muted': mistLightColors.surfaceMuted,
  '--sc-ink': mistLightColors.text,
  '--sc-muted': mistLightColors.textMuted,
  '--sc-disabled': mistLightColors.textDisabled,
  '--sc-action': mistLightColors.primary,
  '--sc-on-action': mistLightColors.onPrimary,
  '--sc-action-surface': mistLightColors.primarySurface,
  '--sc-on-action-surface': mistLightColors.onPrimarySurface,
  '--sc-line': mistLightColors.border,
  '--sc-line-strong': mistLightColors.borderStrong,
  '--sc-danger': mistLightColors.danger,
  '--sc-danger-surface': mistLightColors.dangerSurface,
  '--sc-success': mistLightColors.success,
  '--sc-success-surface': mistLightColors.successSurface,
  '--sc-warning': mistLightColors.warning,
  '--sc-warning-surface': mistLightColors.warningSurface,
  '--sc-radius-sm': `${radii.sm}px`,
  '--sc-radius-md': `${radii.md}px`,
  '--sc-space-xs': `${spacing.xs}px`,
  '--sc-space-sm': `${spacing.sm}px`,
  '--sc-space-sm-plus': `${spacing.smPlus}px`,
  '--sc-space-md': `${spacing.md}px`,
  '--sc-space-lg': `${spacing.lg}px`,
  '--sc-space-xl': `${spacing.xl}px`,
  '--sc-font-title': `${typography.title.fontSize}px`,
  '--sc-font-body': `${typography.bodySmall.fontSize}px`,
  '--sc-font-caption': `${typography.caption.fontSize}px`,
  '--sc-line-title': `${typography.title.lineHeight}px`,
  '--sc-line-body': `${typography.bodySmall.lineHeight}px`,
  '--sc-line-caption': `${typography.caption.lineHeight}px`,
}

export function applyAdminCssVars(target: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(adminCssVars)) {
    target.style.setProperty(name, value)
  }
}
