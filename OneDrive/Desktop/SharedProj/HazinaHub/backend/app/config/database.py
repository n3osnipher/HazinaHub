import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGODB_URI)
    return _client


async def init_db():
    """Initialize Beanie ODM with all document models."""
    from app.models.user import User
    from app.models.cashflow import Cashflow
    from app.models.mmf_fund import MmfFund
    from app.models.investment import Investment
    from app.models.portfolio_snapshot import PortfolioSnapshot
    from app.models.ai_insight import AiInsight
    from app.models.fraud_alert import FraudAlert
    from app.models.chat_message import ChatMessage

    client = get_client()
    db_name = os.getenv("MONGODB_DB_NAME", "hazinahub")
    db = client[db_name]

    await init_beanie(
        database=db,
        document_models=[
            User,
            Cashflow,
            MmfFund,
            Investment,
            PortfolioSnapshot,
            AiInsight,
            FraudAlert,
            ChatMessage,
        ],
    )
    print("[OK] Connected to MongoDB and initialized Beanie ODM")

    # Seed default MMF funds if collection is empty or if NCBA is missing (to force re-seed)
    if await MmfFund.count() == 0 or not await MmfFund.find_one(MmfFund.provider == "NCBA Investment Bank"):
        print("[INFO] Clearing and re-seeding investment funds...")
        await MmfFund.find_all().delete()
        default_funds = [
            # Money Market Funds
            MmfFund(
                name="Sanlam Money Market Fund",
                provider="Sanlam Investments",
                interest_rate=13.5,
                minimum_investment=2500.0,
                risk_level="low",
                maturity_days=0,
                total_aum=12000000.0,
                description="One of Kenya's largest and most consistent MMFs, offering high yields and instant liquidity.",
                website_url="https://www.sanlam.com/kenya",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699649/hazinahub/logos/logo_sanlam_investments.png",
                asset_class="MMF",
                is_active=True
            ),
            MmfFund(
                name="CIC Money Market Fund",
                provider="CIC Asset Management",
                interest_rate=12.8,
                minimum_investment=5000.0,
                risk_level="low",
                maturity_days=0,
                total_aum=15500000.0,
                description="Very stable fund managed by CIC Group, ideal for capital preservation and emergency funds.",
                website_url="https://cic.co.ke",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699651/hazinahub/logos/logo_cic_asset_management.png",
                asset_class="MMF",
                is_active=True
            ),
            MmfFund(
                name="Zimele (ZIIDI) Money Market Fund",
                provider="Zimele Asset Management",
                interest_rate=11.5,
                minimum_investment=100.0,
                risk_level="low",
                maturity_days=0,
                total_aum=4200000.0,
                description="Highly accessible MMF with a very low minimum investment, perfect for beginners and micro-savers.",
                website_url="https://zimele.co.ke",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699844/hazinahub/logos/logo_zimele_asset_management.jpg",
                asset_class="MMF",
                is_active=True
            ),
            MmfFund(
                name="GenAfrica Money Market Fund",
                provider="GenAfrica Asset Management",
                interest_rate=14.2,
                minimum_investment=1000.0,
                risk_level="medium",
                maturity_days=0,
                total_aum=8900000.0,
                description="High-performing fund focused on yield optimization with medium risk exposure.",
                website_url="https://genafrica.com",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699655/hazinahub/logos/logo_genafrica_asset_management.png",
                asset_class="MMF",
                is_active=True
            ),
            MmfFund(
                name="NCBA Money Market Fund",
                provider="NCBA Investment Bank",
                interest_rate=13.9,
                minimum_investment=5000.0,
                risk_level="low",
                maturity_days=0,
                total_aum=10500000.0,
                description="A high-yielding MMF by NCBA Group, boasting great stability and smooth digital checkout portals.",
                website_url="https://ncbagroup.com",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699658/hazinahub/logos/logo_ncba_investment_bank.png",
                asset_class="MMF",
                is_active=True
            ),
            MmfFund(
                name="ICEA Lion Money Market Fund",
                provider="ICEA Lion Asset Management",
                interest_rate=12.5,
                minimum_investment=500.0,
                risk_level="low",
                maturity_days=0,
                total_aum=7300000.0,
                description="Flexible fund with a low minimum deposit threshold, perfect for routine cash buffer building.",
                website_url="https://icealion.com",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699661/hazinahub/logos/logo_icea_lion_asset_management.png",
                asset_class="MMF",
                is_active=True
            ),
            MmfFund(
                name="Co-op Money Market Fund",
                provider="Co-op Trust Investment Services",
                interest_rate=13.0,
                minimum_investment=2000.0,
                risk_level="low",
                maturity_days=0,
                total_aum=9200000.0,
                description="Stable returns managed by Co-operative Bank subsidiary, perfect for corporate cash flow buffers.",
                website_url="https://www.co-opbank.co.ke",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699664/hazinahub/logos/logo_co_op_trust_investment_services.png",
                asset_class="MMF",
                is_active=True
            ),
            # SACCOs
            MmfFund(
                name="Stima SACCO Shares & Deposits",
                provider="Stima SACCO",
                interest_rate=13.5,
                minimum_investment=1000.0,
                risk_level="medium",
                maturity_days=0,
                total_aum=35000000.0,
                description="High-yield dividends on shares and deposit accumulation acting as a borrowing multiplier.",
                website_url="https://www.stima-sacco.com",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699735/hazinahub/logos/logo_stima_sacco.png",
                asset_class="SACCO",
                is_active=True
            ),
            MmfFund(
                name="Kenya Police SACCO Shares & Deposits",
                provider="Kenya Police SACCO",
                interest_rate=14.0,
                minimum_investment=2000.0,
                risk_level="medium",
                maturity_days=0,
                total_aum=48000000.0,
                description="Excellent dividends and credit multiplier benefits with one of Kenya's largest co-operatives.",
                website_url="https://www.policesacco.com",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699668/hazinahub/logos/logo_kenya_police_sacco.png",
                asset_class="SACCO",
                is_active=True
            ),
            MmfFund(
                name="Harambee SACCO Shares & Deposits",
                provider="Harambee SACCO",
                interest_rate=12.5,
                minimum_investment=1000.0,
                risk_level="medium",
                maturity_days=0,
                total_aum=28000000.0,
                description="Reliable wealth accumulation co-operative popular for medium-term capital multipliers.",
                website_url="https://harambeesacco.com",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699672/hazinahub/logos/logo_harambee_sacco.png",
                asset_class="SACCO",
                is_active=True
            ),
            MmfFund(
                name="Safaricom Investment Co-operative Shares",
                provider="Safaricom Co-op",
                interest_rate=12.8,
                minimum_investment=1500.0,
                risk_level="medium",
                maturity_days=0,
                total_aum=19000000.0,
                description="Enjoy regular dividends and real estate investment Multipliers with Safaricom's investment arm.",
                website_url="https://sic.co.ke",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699675/hazinahub/logos/logo_safaricom_co_op.png",
                asset_class="SACCO",
                is_active=True
            ),
            # T-Bills
            MmfFund(
                name="CBK Treasury Bills (91-Day)",
                provider="CBK DhowCSD Portal",
                interest_rate=15.8,
                minimum_investment=50000.0,
                risk_level="sovereign",
                maturity_days=91,
                total_aum=150000000.0,
                description="Guaranteed sovereign debt security offering fixed high returns upon maturity.",
                website_url="https://www.dhowcsd.go.ke",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699678/hazinahub/logos/logo_cbk_dhowcsd_portal.png",
                asset_class="T-Bill",
                is_active=True
            ),
            MmfFund(
                name="CBK Treasury Bills (182-Day)",
                provider="CBK DhowCSD Portal",
                interest_rate=16.2,
                minimum_investment=50000.0,
                risk_level="sovereign",
                maturity_days=182,
                total_aum=175000000.0,
                description="Risk-free government bills yielding high guaranteed returns over 182 days.",
                website_url="https://www.dhowcsd.go.ke",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699678/hazinahub/logos/logo_cbk_dhowcsd_portal.png",
                asset_class="T-Bill",
                is_active=True
            ),
            MmfFund(
                name="CBK Treasury Bills (364-Day)",
                provider="CBK DhowCSD Portal",
                interest_rate=16.8,
                minimum_investment=50000.0,
                risk_level="sovereign",
                maturity_days=364,
                total_aum=210000000.0,
                description="Excellent high-yield sovereign investment locked in for a full year of growth.",
                website_url="https://www.dhowcsd.go.ke",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699678/hazinahub/logos/logo_cbk_dhowcsd_portal.png",
                asset_class="T-Bill",
                is_active=True
            ),
            # Stocks
            MmfFund(
                name="Safaricom Blue-Chip Stock",
                provider="Safaricom PLC",
                interest_rate=6.5,
                minimum_investment=1800.0,
                risk_level="high",
                maturity_days=0,
                total_aum=720000000.0,
                description="Dual-return stock offering capital growth and robust dividends from East Africa's telecom giant.",
                website_url="https://www.safaricom.co.ke",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699681/hazinahub/logos/logo_safaricom_plc.png",
                asset_class="Stock",
                is_active=True
            ),
            MmfFund(
                name="Equity Bank Blue-Chip Stock",
                provider="Equity Bank Group",
                interest_rate=7.2,
                minimum_investment=4000.0,
                risk_level="high",
                maturity_days=0,
                total_aum=410000000.0,
                description="Premier blue-chip banking stock offering excellent dividend payouts and growth hedge.",
                website_url="https://www.equitygroupholdings.com",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699683/hazinahub/logos/logo_equity_bank_group.png",
                asset_class="Stock",
                is_active=True
            ),
            MmfFund(
                name="KCB Group Blue-Chip Stock",
                provider="KCB Group",
                interest_rate=7.5,
                minimum_investment=3800.0,
                risk_level="high",
                maturity_days=0,
                total_aum=390000000.0,
                description="Solid financial institution shares on the NSE providing high capital yields and dividends.",
                website_url="https://kcbgroup.com",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699686/hazinahub/logos/logo_kcb_group.png",
                asset_class="Stock",
                is_active=True
            ),
            MmfFund(
                name="Co-operative Bank Blue-Chip Stock",
                provider="Co-op Bank Group",
                interest_rate=8.0,
                minimum_investment=1300.0,
                risk_level="high",
                maturity_days=0,
                total_aum=320000000.0,
                description="Consistent dividend payouts and high liquidity banking stock listed on the NSE.",
                website_url="https://www.co-opbank.co.ke",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699688/hazinahub/logos/logo_co_op_bank_group.png",
                asset_class="Stock",
                is_active=True
            ),
            MmfFund(
                name="EABL Blue-Chip Stock",
                provider="East African Breweries",
                interest_rate=5.8,
                minimum_investment=14000.0,
                risk_level="high",
                maturity_days=0,
                total_aum=290000000.0,
                description="Dominant FMCG stock on the Nairobi Securities Exchange with a record of strong dividend yields.",
                website_url="https://www.eabl.com",
                logo_url="https://res.cloudinary.com/dp4d2mgdq/image/upload/v1781699691/hazinahub/logos/logo_east_african_breweries.png",
                asset_class="Stock",
                is_active=True
            )
        ]
        await MmfFund.insert_many(default_funds)
        print("[OK] Seeded new default investments (MMFs, SACCOs, T-Bills, Stocks) into database")
