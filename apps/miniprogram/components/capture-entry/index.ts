Component({
  data: { open: false },
  methods: {
    toggle() {
      this.setData({ open: !this.data.open })
    },
    close() {
      this.setData({ open: false })
    },
    select(event: WechatMiniprogram.TouchEvent) {
      this.close()
      this.triggerEvent('select', { mode: String(event.currentTarget.dataset.mode) })
    },
  },
})
