import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import { useLocaleStore } from "@/store/localeStore";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setUser: (user) => {
        useLocaleStore.getState().syncLocaleWithUser(user);
        set({ user, isAuthenticated: true });
      },
      setAccessToken: (token) => set({ accessToken: token, isAuthenticated: Boolean(token) }),

      setAuth: (user, token) => {
        useLocaleStore.getState().syncLocaleWithUser(user);
        set({ user, accessToken: token, isAuthenticated: true });
      },

      logout: () => {
        useLocaleStore.getState().resetLocale();
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: "asalingo-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          useLocaleStore.getState().syncLocaleWithUser(state.user);
        }
      },
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
