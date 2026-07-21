import { QueryClient } from "@tanstack/react-query";

/**
 * Yagona QueryClient — main.tsx ham, auth store ham ishlatadi. Logout'da
 * `queryClient.clear()` chaqiriladi (bir foydalanuvchi keshini boshqasi ko'rmasin).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
