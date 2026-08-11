import mongoose, { type InferSchemaType, model } from 'mongoose';

const adRewardSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    nonce: { type: String, required: true, unique: true },
    adUnitId: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'credited', 'void'], default: 'pending' },
    rewardCents: { type: Number, default: 0 },
    deviceId: { type: String, default: '' },
    creditedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type AdRewardDoc = InferSchemaType<typeof adRewardSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const AdReward = model('AdReward', adRewardSchema);
