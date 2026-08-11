import mongoose, { type InferSchemaType, model } from 'mongoose';

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';

const withdrawalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    method: { type: String, enum: ['paypal', 'crypto'], required: true },
    destination: { type: String, required: true },
    amountCents: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
    adminNote: { type: String, default: '' },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type WithdrawalRequestDoc = InferSchemaType<typeof withdrawalSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const WithdrawalRequest = model('WithdrawalRequest', withdrawalSchema);