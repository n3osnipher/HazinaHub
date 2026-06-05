import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { MmfFund } from '../models/MmfFund';

// Load env vars from the root directory
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const initialFunds = [
  {
    name: 'CIC Money Market Fund',
    provider: 'CIC Asset Management',
    interestRate: 13.52,
    minimumInvestment: 5000,
    riskLevel: 'low',
    maturityDays: 0,
    totalAum: 65000000000,
    description: 'One of Kenya\'s largest and most stable money market funds, offering competitive daily compounded interest.',
    websiteUrl: 'https://cic.co.ke/asset-management/money-market-fund/',
    isActive: true
  },
  {
    name: 'Sanlam Pesa Market Fund',
    provider: 'Sanlam Investments',
    interestRate: 11.20,
    minimumInvestment: 2500,
    riskLevel: 'low',
    maturityDays: 0,
    totalAum: 42000000000,
    description: 'A low-risk investment vehicle designed to offer capital preservation while generating consistent returns.',
    websiteUrl: 'https://www.sanlam.com/kenya',
    isActive: true
  },
  {
    name: 'Nabo Africa Money Market Fund',
    provider: 'Nabo Capital',
    interestRate: 14.15,
    minimumInvestment: 100000,
    riskLevel: 'medium',
    maturityDays: 0,
    totalAum: 12000000000,
    description: 'High-yield fund targeting institutional and high-net-worth investors looking for premium returns.',
    websiteUrl: 'https://nabocapital.com/',
    isActive: true
  },
  {
    name: 'ICEA Lion Money Market Fund',
    provider: 'ICEA LION Asset Management',
    interestRate: 12.85,
    minimumInvestment: 500,
    riskLevel: 'low',
    maturityDays: 0,
    totalAum: 38000000000,
    description: 'Highly accessible fund with a very low entry point, perfect for beginners looking to grow wealth safely.',
    websiteUrl: 'https://icealion.co.ke/asset-management/',
    isActive: true
  },
  {
    name: 'Etica Wealth Money Market',
    provider: 'Etica Capital',
    interestRate: 15.01,
    minimumInvestment: 100,
    riskLevel: 'medium',
    maturityDays: 0,
    totalAum: 5000000000,
    description: 'A highly aggressive money market fund providing top-tier yield through strategic short-term paper investments.',
    websiteUrl: 'https://eticacapital.co.ke/',
    isActive: true
  }
];

const seedMmf = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI is missing');

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB for Seeding');

    await MmfFund.deleteMany({});
    console.log('🧹 Cleared existing MMF funds');

    await MmfFund.insertMany(initialFunds);
    console.log(`✅ Successfully seeded ${initialFunds.length} MMF funds`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedMmf();
