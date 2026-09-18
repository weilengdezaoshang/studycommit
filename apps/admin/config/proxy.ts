const apiOrigin = process.env.ADMIN_API_ORIGIN ?? 'http://localhost:3000'

export const proxy = {
  '/api': {
    target: apiOrigin,
    changeOrigin: true,
  },
}
