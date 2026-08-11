import { create } from 'zustand';
import { setToken, getToken } from '@/api/client';
import { authApi } from '@/api/auth';
import type { Terms, User } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  currentTerms: Terms | null;
  initialized: boolean;
  loading: boolean;
  restore: () => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    displayName?: string;
    referralCode?: string;
    deviceId?: string;
  }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  acceptTerms: (version: number) => Promise<void>;
  refresh: () => Promise<void>;
}

function applyUser(res: { token: string; user: User }) {
  return { user: res.user, token: res.token };
}

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  currentTerms: null,
  initialized: false,
  loading: false,

  restore: async () => {
    const token = await getToken();
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const [me, terms] = await Promise.all([authApi.me(), authApi.currentTerms().catch(() => null)]);
      set({
        token,
        user: me.data.user,
        currentTerms: terms?.data.terms ?? null,
        initialized: true,
      });
    } catch {
      await setToken(null);
      set({ token: null, user: null, initialized: true });
    }
  },

  signUp: async (input) => {
    const res = await authApi.signup(input);
    set((s) => ({ ...applyUser(res.data) }));
    await setToken(res.data.token);
    const terms = await authApi.currentTerms().catch(() => null);
    set({ currentTerms: terms?.data.terms ?? null });
  },

  signIn: async (input) => {
    const res = await authApi.signin(input);
    set((s) => ({ ...applyUser(res.data) }));
    await setToken(res.data.token);
    const terms = await authApi.currentTerms().catch(() => null);
    set({ currentTerms: terms?.data.terms ?? null });
  },

  signOut: async () => {
    await setToken(null);
    set({ token: null, user: null, currentTerms: null });
  },

  acceptTerms: async (version) => {
    const res = await authApi.acceptTerms(version);
    const me = await authApi.me();
    set((s) => ({
      user: { ...(s.user as User), ...me.data.user, termsAccepted: res.data.termsAccepted },
    }));
  },

  refresh: async () => {
    const me = await authApi.me();
    set({ user: me.data.user });
  },
}));

// Convenience selector
export function useNeedsTerms(): boolean {
  const { user, currentTerms } = useAuth();
  if (!user || !currentTerms) return false;
  return user.termsAccepted.version !== currentTerms.version;
}
