import { QueryClient } from '@tanstack/react-query'
import { AdminApiError } from './api-client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
          return false
        }
        return failureCount < 1
      },
    },
    mutations: {
      retry: false,
    },
  },
})

export function invalidateAdminQueries() {
  void queryClient.invalidateQueries()
}

export function clearAdminQueries() {
  queryClient.clear()
}
