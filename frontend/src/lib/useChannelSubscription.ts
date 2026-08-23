import { useQuery } from "@tanstack/react-query";
import { authApi } from "./api";

/** Test yechish sahifalarida ishlatiladi — joriy foydalanuvchi kanalga obuna
 * ekanini tekshiradi. `subQuery.data.subscribed === false` bo'lsa modal ko'rsatiladi. */
export function useChannelSubscription() {
  return useQuery({
    queryKey: ["telegramSubscription"],
    queryFn: authApi.telegramSubscription,
    staleTime: 60_000,
    retry: false,
  });
}
