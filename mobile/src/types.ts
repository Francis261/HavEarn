export interface TermsAccepted {
  version: number | null;
  acceptedAt: string | null;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  balanceCents: number;
  lifetimeEarnedCents: number;
  referralCode: string;
  termsAccepted: TermsAccepted;
}

export interface ApiError {
  error?: string;
  message?: string;
}

export type TransactionType =
  | 'ad'
  | 'task'
  | 'bandwidth'
  | 'referral'
  | 'withdrawal'
  | 'adjustment';

export interface Transaction {
  _id: string;
  id?: string;
  type: TransactionType;
  amountCents: number;
  note: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: 'external_link' | 'install_check' | 'survey';
  rewardCents: number;
  url: string;
  requirements: string;
  cooldownMs: number;
  status: 'available' | 'pending' | 'approved' | 'rejected';
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface WithdrawalRequest {
  id: string;
  method: 'paypal' | 'crypto';
  destination: string;
  amountCents: number;
  status: WithdrawalStatus;
  adminNote: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface Terms {
  version: number;
  title: string;
  content: string;
}

export interface RelayNode {
  id: string;
  token: string;
  label: string;
  status: 'online' | 'offline' | 'disabled';
}

export interface RegisterNodeResult {
  node: RelayNode;
  relayWsUrl: string;
  canShare: boolean;
}
