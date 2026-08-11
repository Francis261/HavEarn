import mongoose from 'mongoose';
import { Transaction, type EarningsType } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { config } from '../config.js';

export interface CreditOptions {
  note?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Credits (or debits, if amount is negative) a user balance atomically and
 * records a transaction. Money is stored as integer cents.
 */
export async function creditBalance(
  userId: string,
  type: EarningsType,
  amountCents: number,
  options?: CreditOptions,
): Promise<{ runningBalance: number }> {
  if (!Number.isInteger(amountCents) || amountCents === 0) {
    throw new Error('amountCents must be a non-zero integer');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error('User not found');

    const next = user.balanceCents + amountCents;
    if (next < 0) throw new Error('Insufficient balance');

    user.balanceCents = next;
    if (amountCents > 0) {
      user.lifetimeEarnedCents += amountCents;
    }
    await user.save({ session });

    const typeValue: EarningsType = type;
    await Transaction.create(
      [
        {
          userId,
          type: typeValue,
          amountCents,
          note: options?.note ?? '',
          metadata: options?.metadata ?? {},
        },
      ],
      { session },
    );

    await session.commitTransaction();
    return { runningBalance: next };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export { config as rates };