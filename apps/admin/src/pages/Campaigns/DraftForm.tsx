import { spacing } from '@studycommit/design-tokens'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Typography,
} from 'antd'
import { history } from '@umijs/max'
import { useState } from 'react'
import type { DraftFormValues } from './draft-form'
import { timezone, validateDraftForm } from './draft-form'
import { campaignTypeLabel } from '@/components/StatusTag'
import { useUnsavedPrompt } from '@/hooks/use-unsaved-prompt'
import { formatBudget, formatCredits, formatDateTime } from '@/utils/format'
import { toShanghaiIso } from '@/utils/shanghai-time'
import { REASON_MAX } from '@/utils/reason'

export function CampaignDraftForm({
  mode,
  submitting,
  locked,
  onFinish,
  initialValues,
}: {
  mode: 'create' | 'edit'
  submitting?: boolean
  locked?: boolean
  onFinish: (values: DraftFormValues) => void
  initialValues?: Partial<DraftFormValues>
}) {
  const [form] = Form.useForm<DraftFormValues>()
  const values = Form.useWatch([], form) as Partial<DraftFormValues> | undefined
  const [dirty, setDirty] = useState(false)
  const readOnlyMeta = mode === 'edit'
  useUnsavedPrompt(dirty && !submitting)

  const submit = (formValues: DraftFormValues) => {
    const errors = validateDraftForm(formValues, mode)
    if (Object.keys(errors).length > 0) {
      form.setFields(
        Object.entries(errors).map(([name, message]) => ({
          name: name as keyof DraftFormValues,
          errors: message ? [message] : [],
        })),
      )
      return
    }
    onFinish(formValues)
  }

  return (
    <Row gutter={spacing.lg}>
      <Col xs={24} xl={16}>
        <Form<DraftFormValues>
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onValuesChange={() => setDirty(true)}
          onFinish={submit}
        >
          <Card title="基本信息" style={{ marginBottom: spacing.md }}>
            <Row gutter={spacing.md}>
              <Col span={12}>
                <Form.Item
                  name="code"
                  label="活动代码"
                  rules={
                    readOnlyMeta
                      ? []
                      : [
                          { required: true, message: '请填写活动 code' },
                          { pattern: /^[a-z0-9-]+$/, message: '仅允许小写字母、数字与连字符' },
                          { min: 2, max: 64, message: '长度 2–64' },
                        ]
                  }
                >
                  <Input disabled={readOnlyMeta} placeholder="autumn-2026" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="type"
                  label="活动类型"
                  rules={readOnlyMeta ? [] : [{ required: true }]}
                >
                  <Select
                    disabled={readOnlyMeta}
                    options={[
                      { value: 'limited_claim', label: '限时领取' },
                      { value: 'registration_bonus', label: '注册奖励' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          <Card title="领取规则" style={{ marginBottom: spacing.md }}>
            <Row gutter={spacing.md}>
              <Col span={8}>
                <Form.Item
                  name="startsAt"
                  label="开始时间"
                  rules={[{ required: true, message: '请选择开始时间' }]}
                >
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="endsAt"
                  label="结束时间"
                  dependencies={['startsAt']}
                  rules={[
                    { required: true, message: '请选择结束时间' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const start = getFieldValue('startsAt')
                        if (!value || !start || start.isBefore(value)) {
return Promise.resolve()
}
                        return Promise.reject(new Error('结束时间必须晚于开始时间'))
                      },
                    }),
                  ]}
                >
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="时区">
                  <Input value={timezone} disabled />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="grantCredits"
                  label="每次领取积分"
                  rules={[{ required: true, message: '发放积分须为 1 到 1000000000 的整数' }]}
                >
                  <InputNumber
                    min={1}
                    max={1_000_000_000}
                    precision={0}
                    step={1}
                    style={{ width: '100%' }}
                    addonAfter="积分"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="perUserLimit" label="每人领取次数" rules={[{ required: true }]}>
                  <InputNumber
                    min={1}
                    max={100}
                    precision={0}
                    step={1}
                    style={{ width: '100%' }}
                    addonBefore="每人"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="validityMode" label="有效期" rules={[{ required: true }]}>
                  <Radio.Group>
                    <Radio.Button value="days">按天数</Radio.Button>
                    <Radio.Button value="fixed">固定截止</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, next) =>
                    prev.validityMode !== next.validityMode || prev.endsAt !== next.endsAt
                  }
                >
                  {({ getFieldValue }) =>
                    getFieldValue('validityMode') === 'fixed' ? (
                      <Form.Item
                        name="fixedExpiresAt"
                        label="固定截止时刻"
                        dependencies={['endsAt']}
                        rules={[
                          { required: true, message: '请选择固定截止时刻' },
                          ({ getFieldValue: get }) => ({
                            validator(_, value) {
                              const ends = get('endsAt')
                              if (!value || !ends || !value.isBefore(ends)) {
return Promise.resolve()
}
                              return Promise.reject(new Error('固定截止时刻不能早于领取窗口结束'))
                            },
                          }),
                        ]}
                      >
                        <DatePicker showTime style={{ width: '100%' }} />
                      </Form.Item>
                    ) : (
                      <Form.Item
                        name="creditValidityDays"
                        label="有效天数"
                        rules={[{ required: true }]}
                      >
                        <InputNumber
                          min={1}
                          max={3650}
                          precision={0}
                          step={1}
                          style={{ width: '100%' }}
                          addonAfter="天"
                        />
                      </Form.Item>
                    )
                  }
                </Form.Item>
              </Col>
            </Row>
          </Card>
          <Card title="活动规模" style={{ marginBottom: spacing.md }}>
            <Typography.Paragraph type="secondary">
              留空为不限；0 表示无可用额度。编辑时总预算与总领取上限不可修改。
            </Typography.Paragraph>
            <Row gutter={spacing.md}>
              <Col span={12}>
                <Form.Item name="totalBudgetCredits" label="总预算">
                  <InputNumber
                    min={0}
                    precision={0}
                    step={1}
                    style={{ width: '100%' }}
                    addonAfter="积分"
                    disabled={readOnlyMeta}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="totalClaimLimit" label="总领取次数上限">
                  <InputNumber
                    min={0}
                    precision={0}
                    step={1}
                    style={{ width: '100%' }}
                    addonAfter="次"
                    disabled={readOnlyMeta}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          <Card title="展示文案" style={{ marginBottom: spacing.md }}>
            <Form.Item name="title" label="活动标题" rules={[{ required: true, max: 120 }]}>
              <Input maxLength={120} showCount />
            </Form.Item>
            <Form.Item name="description" label="活动描述" rules={[{ required: true, max: 500 }]}>
              <Input.TextArea maxLength={500} showCount />
            </Form.Item>
            <Form.Item
              name="successMessage"
              label="领取成功文案"
              rules={[{ required: true, max: 200 }]}
            >
              <Input maxLength={200} showCount />
            </Form.Item>
            <Form.Item
              name="platforms"
              label="展示平台"
              rules={[{ required: true, type: 'array', min: 1 }]}
            >
              <Select
                mode="multiple"
                options={[
                  { value: 'desktop', label: '桌面端' },
                  { value: 'mobile', label: '移动端' },
                  { value: 'miniprogram', label: '小程序' },
                ]}
              />
            </Form.Item>
          </Card>
          <Card title="操作理由">
            <Form.Item
              name="reason"
              label="操作理由"
              rules={[{ required: true, message: '必须填写理由' }, { max: REASON_MAX }]}
            >
              <Input.TextArea maxLength={REASON_MAX} showCount />
            </Form.Item>
            <Typography.Paragraph type="secondary">
              保存草稿不会发布，确认无误后再到详情页发布。
            </Typography.Paragraph>
            <Space>
              <Button onClick={() => history.push('/campaigns')}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting} disabled={locked}>
                保存草稿
              </Button>
            </Space>
          </Card>
        </Form>
      </Col>
      <Col xs={24} xl={8}>
        <Card title="用户端预览">
          <Typography.Text type="secondary">
            {values?.type ? campaignTypeLabel(values.type) : '限时领取'} ·{' '}
            {values?.startsAt && values?.endsAt
              ? `${formatDateTime(toShanghaiIso(values.startsAt), 'MM-DD HH:mm')} – ${formatDateTime(toShanghaiIso(values.endsAt), 'MM-DD HH:mm')}`
              : '未设置窗口'}
          </Typography.Text>
          <Typography.Title level={4}>{values?.title || '活动标题'}</Typography.Title>
          <Typography.Paragraph>{values?.description || '活动描述'}</Typography.Paragraph>
          <Typography.Title level={3} className="tabular-nums">
            {formatCredits(values?.grantCredits ?? 0)} 积分
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            {values?.successMessage || '领取成功文案'}
          </Typography.Paragraph>
          <Space split="|" wrap>
            <span>每人限领 {values?.perUserLimit ?? 1} 次</span>
            <span>
              {values?.validityMode === 'fixed'
                ? `截止 ${values.fixedExpiresAt ? formatDateTime(toShanghaiIso(values.fixedExpiresAt), 'YYYY-MM-DD') : '—'}`
                : `有效期 ${values?.creditValidityDays ?? '—'} 天`}
            </span>
            <span>
              总领取上限 {formatBudget(values?.totalClaimLimit ?? null).replace('积分', '次')}
            </span>
          </Space>
        </Card>
      </Col>
    </Row>
  )
}
