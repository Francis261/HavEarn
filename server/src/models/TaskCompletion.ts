import mongoose, { type InferSchemaType, model } from 'mongoose';

const taskCompletionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    rewardCents: { type: Number, default: 0 },
    claimToken: { type: String, unique: true },
    note: { type: String, default: '' },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

taskCompletionSchema.index({ userId: 1, taskId: 1 }, { unique: true });

export type TaskCompletionDoc = InferSchemaType<typeof taskCompletionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const TaskCompletion = model('TaskCompletion', taskCompletionSchema);
