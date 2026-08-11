import mongoose, { type InferSchemaType, model } from 'mongoose';

export type TaskType = 'external_link' | 'install_check' | 'survey';

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['external_link', 'install_check', 'survey'], required: true },
    rewardCents: { type: Number, required: true },
    url: { type: String, default: '' },
    requirements: { type: String, default: '' },
    active: { type: Boolean, default: true },
    cooldownMs: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type TaskDoc = InferSchemaType<typeof taskSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Task = model('Task', taskSchema);
