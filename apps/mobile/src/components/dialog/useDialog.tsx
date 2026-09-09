import { View } from 'react-native'
import { useDialogController } from '@studycommit/common/dialog-react'
import { useOptionalToast } from '@studycommit/common/toast-react'
import { useAppTheme } from '../../theme/ThemeProvider'
import { AppText } from '../AppText'
import { Button } from '../Button'
import { TextField } from '../TextField'
import { Dialog } from './Dialog'

export type {
  DialogFieldOptions,
  DialogNoteField,
  DialogShowOptions,
} from '@studycommit/common/dialog-react'

/**
 * 移动对话框:状态机复用 @studycommit/common/dialog-react。
 * 确认失败直接关闭并把错误交给 Toast(桌面端为保持打开内联展示)。
 */
export function useDialog() {
  const theme = useAppTheme()
  const toast = useOptionalToast()
  const controller = useDialogController({
    actionErrorMode: 'dismiss',
    onActionError: (error) => {
      toast?.show({
        message: error instanceof Error ? error.message : '操作失败，请稍后重试。',
        type: 'error',
      })
    },
  })
  const { options } = controller

  const dialog = (
    <Dialog
      busy={controller.busy}
      onClose={controller.close}
      onDismiss={controller.dismiss}
      open={controller.visible}
      title={options?.title ?? ''}
    >
      {options?.description ? <AppText color="muted">{options.description}</AppText> : null}
      {options?.extraContent}
      {options?.field ? (
        <TextField
          error={controller.fieldError ?? undefined}
          helperText={options.field.helperText}
          label={options.field.label}
          maxLength={options.field.maxLength}
          onChangeText={controller.updateField}
          placeholder={options.field.type === 'datetime-local' ? 'YYYY-MM-DDTHH:mm' : undefined}
          value={controller.fieldValue}
        />
      ) : null}
      {controller.fieldError && !options?.field ? (
        <AppText color="danger">{controller.fieldError}</AppText>
      ) : null}
      {options?.notes?.map((note) => (
        <TextField
          key={note.key}
          label={note.label}
          maxLength={note.maxLength}
          multiline
          onChangeText={(value) => controller.updateNote(note.key, value)}
          placeholder={note.placeholder}
          scrollEnabled
          style={{ height: 96, maxHeight: 96 }}
          value={controller.notes[note.key] ?? ''}
        />
      ))}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
        <Button disabled={controller.busy} onPress={controller.close} variant="secondary">
          {options?.cancelLabel ?? '取消'}
        </Button>
        <Button loading={controller.busy} onPress={() => void controller.confirm()}>
          {controller.busy
            ? (options?.confirmBusyLabel ?? '处理中')
            : (options?.confirmLabel ?? '确认')}
        </Button>
      </View>
    </Dialog>
  )

  return { show: controller.show, close: controller.close, dialog }
}
