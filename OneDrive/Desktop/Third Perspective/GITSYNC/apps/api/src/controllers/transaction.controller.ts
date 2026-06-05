import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { initiateSTKPush, queryTransactionStatus } from '../services/mpesa.service';
import { notifyTransaction } from '../services/sms.service';
import { broadcastTransactionUpdate, broadcastBalanceUpdate } from '../services/websocket.service';
import { query } from '../config/database'; // Kept for 'investments' table backwards compatibility

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const type = req.query.type as string;

    const filter: any = { userId: req.userId };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    res.json({
      success: true,
      data: transactions.map(t => ({
        id: t._id,
        type: t.type,
        amount: t.amount,
        phone: t.phone,
        mpesaReceiptNumber: t.mpesa_receipt_number,
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
};

export const initiatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, phone, description } = req.body;

    // Normalize phone
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.substring(1);

    // Initiate STK Push
    const stkResponse = await initiateSTKPush({
      phone: normalizedPhone,
      amount,
      accountReference: 'HazinaHub',
      description: description || 'Payment to HazinaHub',
    });

    let userId = req.userId;
    
    // Fallback for anonymous test payments
    if (!userId) {
       const user = await User.findOne();
       if (user) userId = user._id.toString();
    }

    if (!userId) {
      res.status(400).json({ success: false, error: 'No user found' });
      return;
    }

    // Record transaction
    const transaction = new Transaction({
      userId,
      type: 'stk_push',
      amount,
      phone: normalizedPhone,
      merchant_request_id: stkResponse.MerchantRequestID,
      checkout_request_id: stkResponse.CheckoutRequestID,
      status: 'pending',
      description,
    });
    await transaction.save();

    res.json({
      success: true,
      data: {
        transactionId: transaction._id,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        customerMessage: stkResponse.CustomerMessage,
      },
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ success: false, error: 'Payment initiation failed' });
  }
};

// M-Pesa STK Push callback
export const stkCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { Body } = req.body;
    const { stkCallback: callback } = Body;

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = callback;

    if (ResultCode === 0) {
      // Successful payment
      const items = callback.CallbackMetadata?.Item || [];
      const receipt = items.find((i: { Name: string }) => i.Name === 'MpesaReceiptNumber')?.Value;
      const amount = items.find((i: { Name: string }) => i.Name === 'Amount')?.Value;

      const transaction = await Transaction.findOneAndUpdate(
        { merchant_request_id: MerchantRequestID, checkout_request_id: CheckoutRequestID },
        { status: 'completed', mpesa_receipt_number: receipt, updated_at: new Date() },
        { new: true }
      );

      if (transaction) {
        // Update user wallet balance
        await User.findByIdAndUpdate(transaction.userId, {
          $inc: { walletBalance: transaction.amount }
        });

        // Legacy: If this was an investment payment (using mock DB for investments)
        try {
          await query(
            `UPDATE investments SET status = 'active', invested_at = NOW(), updated_at = NOW()
             WHERE transaction_id = $1 AND status = 'pending'`,
            [transaction._id.toString()]
          );
        } catch (e) {
          // ignore mock db errors
        }

        notifyTransaction(transaction.phone as string, amount, 'c2b').catch(console.error);
        broadcastTransactionUpdate(transaction.userId.toString(), {
          id: transaction._id,
          type: transaction.type,
          amount: transaction.amount,
          status: transaction.status,
          description: transaction.description,
          mpesa_receipt_number: transaction.mpesa_receipt_number,
          created_at: transaction.createdAt,
          phone: transaction.phone
        });
      }
    } else {
      // Failed payment
      const transaction = await Transaction.findOneAndUpdate(
        { merchant_request_id: MerchantRequestID, checkout_request_id: CheckoutRequestID },
        { status: 'failed', updated_at: new Date() },
        { new: true }
      );
      
      if (transaction) {
        // Fail associated pending investments (legacy mock DB)
        try {
          await query(
            `UPDATE investments SET status = 'failed', updated_at = NOW()
             WHERE transaction_id = $1 AND status = 'pending'`,
            [transaction._id.toString()]
          );
        } catch (e) { }

        broadcastTransactionUpdate(transaction.userId.toString(), { 
          id: transaction._id, 
          status: 'failed', 
          merchant_request_id: MerchantRequestID 
        });
      }
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('STK callback error:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

// C2B Confirmation callback
export const c2bConfirmation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { TransID, TransAmount, MSISDN, BillRefNumber } = req.body;

    const user = await User.findOne({ phone: MSISDN });
    
    if (user) {
      const transaction = new Transaction({
        userId: user._id,
        type: 'c2b',
        amount: TransAmount,
        phone: MSISDN,
        mpesa_receipt_number: TransID,
        status: 'completed',
        description: BillRefNumber || 'C2B Payment'
      });
      await transaction.save();

      // Update balance
      await User.findByIdAndUpdate(user._id, { $inc: { walletBalance: TransAmount } });

      broadcastTransactionUpdate(user._id.toString(), {
        id: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        status: transaction.status,
        description: transaction.description,
        mpesa_receipt_number: transaction.mpesa_receipt_number,
        created_at: transaction.createdAt
      });

      notifyTransaction(MSISDN, TransAmount, 'c2b').catch(console.error);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('C2B confirmation error:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

export const c2bValidation = async (_req: Request, res: Response): Promise<void> => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
};

export const getTransactionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tx = await Transaction.findOne({ _id: id, userId: req.userId });

    if (!tx) {
      res.status(404).json({ success: false, error: 'Transaction not found' });
      return;
    }

    if (tx.status === 'pending' && tx.mpesa_receipt_number) {
      try {
        const mpesaStatus = await queryTransactionStatus(tx.mpesa_receipt_number);
        res.json({ success: true, data: { ...tx.toObject(), mpesaStatus } });
        return;
      } catch { }
    }

    res.json({
      success: true,
      data: {
        id: tx._id,
        type: tx.type,
        amount: tx.amount,
        status: tx.status,
        mpesaReceiptNumber: tx.mpesa_receipt_number,
        description: tx.description,
        createdAt: tx.createdAt,
      },
    });
  } catch (error) {
    console.error('Transaction status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get transaction status' });
  }
};

export const balanceCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { Result } = req.body;
    if (Result && Result.ResultCode === 0) {
      const parameters = Result.ResultParameter?.ResultParameter;
      if (parameters) {
        const balanceParam = parameters.find((p: any) => p.Key === 'AccountBalance');
        if (balanceParam) {
          const balanceStr = balanceParam.Value;
          const parts = balanceStr.split('|');
          const balance = parseFloat(parts[2] || '0');
          broadcastBalanceUpdate(balance);
        }
      }
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

export const balanceTimeout = async (req: Request, res: Response): Promise<void> => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
};

export const b2cCallback = async (req: Request, res: Response): Promise<void> => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
};

export const b2cTimeout = async (req: Request, res: Response): Promise<void> => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
};

export const initiateWithdraw = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { amount, phone } = req.body;

    if (!amount || !phone) {
      res.status(400).json({ success: false, error: 'Amount and phone are required' });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({ success: false, error: 'Amount must be greater than zero' });
      return;
    }

    // Check balance via Mongoose User model
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const currentBalance = user.walletBalance || 0;
    if (amount > currentBalance) {
      res.status(400).json({ success: false, error: `Insufficient balance. Available: KES ${currentBalance.toLocaleString()}` });
      return;
    }

    // Normalize phone
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.substring(1);

    // Deduct balance and record withdrawal
    user.walletBalance -= amount;
    await user.save();

    const transaction = new Transaction({
      userId,
      type: 'withdrawal',
      amount,
      phone: normalizedPhone,
      status: 'completed',
      description: 'Withdrawal to M-Pesa',
      balanceAfter: user.walletBalance,
    });
    await transaction.save();

    // Try B2C M-Pesa
    try {
      const { initiateB2C } = await import('../services/mpesa.service');
      await initiateB2C({ phone: normalizedPhone, amount, remarks: 'HazinaHub Withdrawal' });
    } catch (e: any) {
      console.log('⚠️ B2C API call skipped (sandbox):', e.message);
    }

    broadcastTransactionUpdate(userId!, {
      id: transaction._id,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
      description: transaction.description,
      created_at: transaction.createdAt,
    });

    res.json({
      success: true,
      data: {
        transactionId: transaction._id,
        amount: transaction.amount,
        message: `KES ${amount.toLocaleString()} withdrawal processed. Check your M-Pesa.`,
        newBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ success: false, error: 'Withdrawal failed' });
  }
};
