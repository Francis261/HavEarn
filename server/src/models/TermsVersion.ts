import mongoose, { type InferSchemaType, model } from 'mongoose';

const termsVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type TermsVersionDoc = InferSchemaType<typeof termsVersionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const TermsVersion = model('TermsVersion', termsVersionSchema);