import mongoose from 'mongoose';

export const connectMongo = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hazinatech';
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected successfully');
  } catch (err: any) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};
