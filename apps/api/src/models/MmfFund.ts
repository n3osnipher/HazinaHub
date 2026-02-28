import mongoose from 'mongoose';

const mmfFundSchema = new mongoose.Schema({
  name: { type: String, required: true },
  provider: { type: String, required: true },
  interestRate: { type: Number, required: true },
  minimumInvestment: { type: Number, required: true },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  maturityDays: { type: Number, default: 0 },
  totalAum: { type: Number, required: true },
  description: { type: String, default: '' },
  websiteUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const MmfFund = mongoose.model('MmfFund', mmfFundSchema);
