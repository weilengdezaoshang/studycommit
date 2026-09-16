Component({
  properties: { rows: Array, title: String, completed: Number },
  methods: {
    retry(event: WechatMiniprogram.TouchEvent) {
      this.triggerEvent('retry', { id: event.currentTarget.dataset.id })
    },
  },
})
