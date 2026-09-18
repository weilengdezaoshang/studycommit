import { mistLightColors, radii, spacing, typography } from '@studycommit/design-tokens'

export function BrandMark({
  collapsed = false,
  inverse = false,
}: {
  collapsed?: boolean
  inverse?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minHeight: 40 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: radii.sm,
          background: mistLightColors.primarySurface,
          color: mistLightColors.onPrimarySurface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: typography.bodySmall.fontSize,
        }}
      >
        SC
      </div>
      {collapsed ? null : (
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ color: inverse ? '#FFFFFF' : mistLightColors.text, fontWeight: 600 }}>
            StudyCommit
          </div>
          <div
            style={{
              color: inverse ? '#B7C9E1' : mistLightColors.textMuted,
              fontSize: typography.caption.fontSize,
            }}
          >
            运营管理
          </div>
        </div>
      )}
    </div>
  )
}
