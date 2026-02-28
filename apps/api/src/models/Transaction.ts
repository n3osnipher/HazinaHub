import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['deposit', 'withdrawal', 'investment', 'return', 'fee', 'refund', 'c2b', 'stk_push', 'b2c'], 
    required: true 
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number },
  description: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  phone: { type: String },
  reference: { type: String },
  merchant_request_id: { type: String },
  checkout_request_id: { type: String },
  mpesa_receipt_number: { type: String },
}, { timestamps: true });

export const Transaction = mongoose.model('Transaction', transactionSchema);
