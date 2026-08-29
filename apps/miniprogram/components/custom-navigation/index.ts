Component({
  properties: {
    title: { type: String, value: '' },
    height: { type: Number, value: 44 },
    rightText: { type: String, value: '' },
    backLabel: { type: String, value: '返回' },
    leadingIcon: { type: String, value: '/assets/icons/back.svg' },
  },

  methods: {
    onBack() {
      this.triggerEvent('back')
    },
    onRightAction() {
      this.triggerEvent('rightaction')
    },
  },
})
