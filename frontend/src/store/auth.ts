import { create } from "zustand";
import { ADMIN_TOKEN_KEY, REFRESH_KEY, TOKEN_KEY } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { UserProfile } from "@/lib/types";

interface AuthState {
  token: string | null;
  adminToken: string | null;
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;
  setUserToken: (access: string, refresh?: string) => void;
  setAdminToken: (token: string) => void;
  logoutUser: () => void;
  logoutAdmin: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  adminToken: localStorage.getItem(ADMIN_TOKEN_KEY),
  user: null,
  setUser: (u) => set({ user: u }),
  setUserToken: (access, refresh) => {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    set({ token: access });
  },
  setAdminToken: (token) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    set({ adminToken: token });
  },
  logoutUser: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    set({ token: null, user: null });
    queryClient.clear(); // boshqa foydalanuvchi eski keshni ko'rmasin
  },
  logoutAdmin: () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    set({ adminToken: null });
    queryClient.clear();
  },
}));
