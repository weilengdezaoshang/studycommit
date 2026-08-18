export function subscribeWindowFocus(onForeground: () => void): () => void {
  window.addEventListener('focus', onForeground)
  return () => {
    window.removeEventListener('focus', onForeground)
  }
}
