import mongoose from 'mongoose';

export async function connectDb(uri: string): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log(`[db] connected to ${uri}`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
