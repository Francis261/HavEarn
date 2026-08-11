import { api } from './client';
import type { Terms, User } from '@/types';

export const authApi = {
  signup: (input: {
    email: string;
    password: string;
    displayName?: string;
    referralCode?: string;
    deviceId?: string;
  }) => api.post<{ token: string; user: User }>('/auth/signup', input),

  signin: (input: { email: string; password: string }) =>
    api.post<{ token: string; user: User }>('/auth/signin', input),

  me: () => api.get<{ user: User }>('/auth/me'),

  acceptTerms: (version: number) =>
    api.post<{ ok: boolean; termsAccepted: User['termsAccepted'] }>('/terms/accept', { version }),

  currentTerms: () => api.get<{ terms: Terms }>('/terms/current'),

  transactions: (page = 1) =>
    api.get<{
      transactions: Array<{
        _id: string;
        type: string;
        amountCents: number;
        note: string;
        createdAt: string;
      }>;
      page: number;
      total: number;
      hasMore: boolean;
    }>('/auth/transactions', { params: { page } }),
};
