Component({
  properties: {
    label: String,
    secondary: Boolean,
    disabled: Boolean,
    loading: Boolean,
    icon: String,
  },
  methods: {
    onPress() {
      if (!this.data.disabled && !this.data.loading) {
        this.triggerEvent('press')
      }
    },
  },
})
