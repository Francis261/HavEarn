import mongoose, { type InferSchemaType, model } from 'mongoose';

export type EarningsType =
  | 'ad'
  | 'task'
  | 'bandwidth'
  | 'referral'
  | 'withdrawal'
  | 'adjustment';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, index: true },
    amountCents: { type: Number, required: true },
    note: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export type TransactionDoc = InferSchemaType<typeof transactionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Transaction = model('Transaction', transactionSchema);
