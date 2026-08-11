import mongoose, { type InferSchemaType, model } from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, default: '' },
    isAdmin: { type: Boolean, default: false },
    balanceCents: { type: Number, default: 0, min: 0 },
    lifetimeEarnedCents: { type: Number, default: 0 },

    referralCode: { type: String, unique: true, index: true },
    referredByCode: { type: String, default: null },

    termsAccepted: {
      version: { type: Number, default: null },
      acceptedAt: { type: Date, default: null },
    },

    deviceId: { type: String, default: '' },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const User = model('User', userSchema);
