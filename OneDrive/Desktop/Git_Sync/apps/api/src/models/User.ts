import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  walletBalance: { type: Number, default: 0, min: 0 },
  first_name: { type: String, default: '' },
  last_name: { type: String, default: '' },
  business_name: { type: String, default: '' },
  portfolio: { type: Object, default: {} }
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
