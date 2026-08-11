import { create } from 'zustand';

export type RelayStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface RelayState {
  enabled: boolean;
  status: RelayStatus;
  sessionBytes: number;
  connectedAt: number | null;
  error: string;
  setEnabled: (v: boolean) => void;
  setStatus: (s: RelayStatus, error?: string) => void;
  addBytes: (n: number) => void;
  resetSession: () => void;
}

export const useRelay = create<RelayState>((set) => ({
  enabled: false,
  status: 'idle',
  sessionBytes: 0,
  connectedAt: null,
  error: '',
  setEnabled: (v) => set({ enabled: v }),
  setStatus: (s, error = '') => set((st) => ({
    status: s,
    error,
    connectedAt: s === 'connected' ? (st.connectedAt ?? Date.now()) : s === 'idle' ? null : st.connectedAt,
  })),
  addBytes: (n) => set((st) => ({ sessionBytes: st.sessionBytes + n })),
  resetSession: () => set({ sessionBytes: 0, connectedAt: null }),
}));