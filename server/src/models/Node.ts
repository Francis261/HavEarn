import mongoose, { type InferSchemaType, model } from 'mongoose';

export type NodeStatus = 'online' | 'offline' | 'disabled';

const nodeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    label: { type: String, default: '' },
    ip: { type: String, default: '' },
    lastSeenAt: { type: Date, default: null },
    status: { type: String, enum: ['online', 'offline', 'disabled'], default: 'offline' },
    totalBytes: { type: Number, default: 0 },
    residualBytes: { type: Number, default: 0 },
    earnedCents: { type: Number, default: 0 },
    sessionBytes: { type: Number, default: 0 },
    lastReportAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type NodeDoc = InferSchemaType<typeof nodeSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Node = model('Node', nodeSchema);