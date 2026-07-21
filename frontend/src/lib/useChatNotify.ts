import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { teachersApi } from "./api";
import type { TeacherPublic, TeacherThread } from "./api";
import { notifySound } from "./notifySound";
import { toast } from "@/components/ui/toast";

/** `a` sanasi `b`dan (oldingi ko'rilgan) KEYINROQ bo'lsagina true.
 * `b === undefined` — hali umuman ko'rilmagan (birinchi poll) -> bildirishnoma yo'q,
 * faqat boshlang'ich holat sifatida saqlanadi (login/reload'da eski voqealar
 * uchun signal berilmasin). */
function isNewer(a: string | null, b: string | null | undefined): boolean {
  if (!a || b === undefined) return false;
  if (!b) return true;
  return new Date(a).getTime() > new Date(b).getTime();
}

/**
 * User tomoni: ustoz javob berganda qisqa signal (ovoz + toast) bilan bildiradi.
 * `/api/teachers` ni fon rejimida so'rab turadi — `RequireUser`da chaqiriladi,
 * shuning uchun foydalanuvchi chat sahifasida bo'lmasa ham (dashboard/mashq/imtihon
 * paytida ham) ishlaydi. Joriy ochiq chat uchun signal berilmaydi (u yerda xabar
 * allaqachon jonli ko'rinadi).
 */
export function useTeacherReplyNotify(enabled: boolean) {
  const location = useLocation();
  const seenRef = useRef<Map<string, string | null>>(new Map());

  const { data } = useQuery({
    queryKey: ["teachers", "notify-poll"],
    queryFn: teachersApi.list,
    enabled,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!data) return;
    for (const t of data as TeacherPublic[]) {
      const prevSeen = seenRef.current.get(t.id);
      const cur = t.threadLastMsgAt ?? null;
      const teacherReplied = t.threadAwaitingReply === false;
      if (teacherReplied && isNewer(cur, prevSeen)) {
        const onThisChat = location.pathname === `/teachers/${t.id}/chat`;
        if (!onThisChat) {
          notifySound.ding();
          toast.info(`${t.name}${t.surname ? " " + t.surname : ""} javob berdi`);
        }
      }
      seenRef.current.set(t.id, cur);
    }
  }, [data, location.pathname]);
}

/**
 * Ustoz tomoni: user yangi xabar yozganda qisqa signal bilan bildiradi.
 * `TeacherLayout`da chaqiriladi — `threads` allaqachon 5s'da so'ralib turibdi
 * (bu hook YANGI so'rov qo'shmaydi, faqat natijani kuzatadi).
 */
export function useNewMessageNotify(threads: TeacherThread[] | undefined) {
  const location = useLocation();
  const seenRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!threads) return;
    for (const th of threads) {
      const prevSeen = seenRef.current.get(th.id);
      const cur = th.lastMsgAt ?? null;
      if (th.awaitingReply && isNewer(cur, prevSeen)) {
        const onThisThread = location.pathname === `/teacher/chat/${th.id}`;
        if (!onThisThread) {
          notifySound.ding();
          toast.info(`${th.userName} yangi xabar yubordi`);
        }
      }
      seenRef.current.set(th.id, cur);
    }
  }, [threads, location.pathname]);
}
