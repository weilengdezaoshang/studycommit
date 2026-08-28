Component({
  properties: {
    action: { type: String, value: '' },
    itemId: { type: String, value: '' },
    icon: { type: String, value: '' },
    label: { type: String, value: '' },
    countLabel: { type: String, value: '0' },
    selected: { type: Boolean, value: false },
  },

  methods: {
    handleTap() {
      this.triggerEvent('select', {
        action: this.data.action,
        itemId: this.data.itemId,
      })
    },
  },
})
