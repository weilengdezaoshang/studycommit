Component({
  properties: { images: Array, selected: Number, removable: Boolean },
  methods: {
    select(event: WechatMiniprogram.TouchEvent) {
      this.triggerEvent('select', { index: Number(event.currentTarget.dataset.index) })
    },
    remove(event: WechatMiniprogram.TouchEvent) {
      this.triggerEvent('remove', { id: String(event.currentTarget.dataset.id) })
    },
  },
})
