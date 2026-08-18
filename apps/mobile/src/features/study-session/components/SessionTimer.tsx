import { AppText } from '../../../components/AppText'

export function SessionTimer({ value }: { value: string }) {
  return (
    <AppText accessibilityLabel={`已学习 ${value}`} variant="title" weight="semibold">
      {value}
    </AppText>
  )
}
