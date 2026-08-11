import { api } from './client';
import type {
  RegisterNodeResult,
  Task,
  WithdrawalRequest,
} from '@/types';

export const earnApi = {
  tasks: () => api.get<{ tasks: Task[] }>('/tasks'),
  completeTask: (id: string) =>
    api.post<{
      ok: boolean;
      status: string;
      rewardCents: number;
      runningBalanceCents?: number;
      note?: string;
    }>(`/tasks/${id}/complete`),

  adStart: (input?: { deviceId?: string; adUnitId?: string }) =>
    api.post<{ nonce: string; rewardCents: number; expiresInMs: number }>('/ads/start', input ?? {}),
  adComplete: (nonce: string) =>
    api.post<{ ok: boolean; rewardCents: number; runningBalanceCents: number }>('/ads/complete', {
      nonce,
    }),

  withdrawalMethods: () =>
    api.get<{
      methods: Array<{ method: 'paypal' | 'crypto'; label: string; placeholder: string }>;
      minWithdrawalCents: number;
    }>('/withdrawals/methods'),
  createWithdrawal: (input: {
    method: 'paypal' | 'crypto';
    destination: string;
    amountCents: number;
  }) => api.post<{ withdrawal: WithdrawalRequest; runningBalanceCents: number }>('/withdrawals', input),
  withdrawals: () => api.get<{ withdrawals: WithdrawalRequest[] }>('/withdrawals'),

  registerNode: () => api.post<RegisterNodeResult>('/relay-nodes/register'),
};