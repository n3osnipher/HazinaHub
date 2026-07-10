import os
import re
import secrets
import smtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from jose import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

ph = PasswordHasher()

JWT_SECRET = os.getenv("JWT_SECRET", "default_secret")
JWT_REFRESH_SECRET = os.getenv("JWT_REFRESH_SECRET", "default_refresh_secret")
ALGORITHM = "HS256"

SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "1025"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@hazinahub.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


def generate_tokens(user_id: str, role: str) -> dict:
    access_token = jwt.encode(
        {"userId": user_id, "role": role, "exp": datetime.utcnow() + timedelta(minutes=15)},
        JWT_SECRET, algorithm=ALGORITHM,
    )
    refresh_token = jwt.encode(
        {"userId": user_id, "role": role, "exp": datetime.utcnow() + timedelta(days=7)},
        JWT_REFRESH_SECRET, algorithm=ALGORITHM,
    )
    return {"accessToken": access_token, "refreshToken": refresh_token}


def send_reset_email(to_email: str, reset_link: str) -> bool:
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg["Subject"] = "Reset Your HazinaHub Password"

        body = f"""
        <p>Hello,</p>
        <p>You requested to reset your password on HazinaHub.</p>
        <p>Click the link below to reset your password. This link is valid for 1 hour:</p>
        <p><a href="{reset_link}">{reset_link}</a></p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Best regards,<br/>HazinaHub Team</p>
        """
        msg.attach(MIMEText(body, "html"))

        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
            if SMTP_PORT == 587:
                server.starttls()
        
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        
        server.sendmail(SMTP_FROM, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send email via SMTP: {e}")
        return False


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    return digits


@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    hashed = ph.hash(body.password)
    phone = normalize_phone(body.phone)

    user = User(
        email=body.email,
        password=hashed,
        phone=phone,
        first_name=body.first_name,
        last_name=body.last_name,
        business_name=body.business_name or "",
    )
    await user.insert()

    tokens = generate_tokens(str(user.id), "user")
    return {
        "success": True,
        "data": {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "phone": user.phone,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "businessName": user.business_name,
                "role": "user",
            },
            **tokens,
        },
    }


@router.post("/login")
async def login(body: LoginRequest):
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=400, detail="Email is not registered. Please sign up first.")

    try:
        ph.verify(user.password, body.password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    # Rehash if needed (argon2 auto-upgrade)
    if ph.check_needs_rehash(user.password):
        user.password = ph.hash(body.password)
        await user.save()

    tokens = generate_tokens(str(user.id), "user")
    return {
        "success": True,
        "data": {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "phone": user.phone,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "businessName": user.business_name,
                "role": "user",
            },
            **tokens,
        },
    }


@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    try:
        decoded = jwt.decode(body.refresh_token, JWT_REFRESH_SECRET, algorithms=[ALGORITHM])
        tokens = generate_tokens(decoded["userId"], decoded["role"])
        return {"success": True, "data": tokens}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    user = await User.get(current_user["userId"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "success": True,
        "data": {
            "id": str(user.id),
            "email": user.email,
            "phone": user.phone,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "businessName": user.business_name,
            "role": user.role,
            "isVerified": user.is_verified,
            "autoInvestEnabled": user.auto_invest_enabled,
            "autoInvestPercentage": user.auto_invest_percentage,
            "createdAt": user.created_at.isoformat(),
        },
    }


async def verify_google_token(credential: str) -> dict:
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get("https://www.googleapis.com/oauth2/v3/certs")
            if res.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch Google certs")
            certs = res.json()
        
        unverified_headers = jwt.get_unverified_header(credential)
        kid = unverified_headers.get("kid")
        if not kid:
            raise HTTPException(status_code=400, detail="Invalid token header: missing kid")
        
        key = None
        for k in certs.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break
        
        if not key:
            raise HTTPException(status_code=400, detail="Public key not found for kid")
        
        options = {}
        if not GOOGLE_CLIENT_ID:
            options["verify_aud"] = False
            
        payload = jwt.decode(
            credential,
            key,
            algorithms=["RS256"],
            audience=GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID else None,
            options=options
        )
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Google authentication failed: {str(e)}")


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=404, detail="There is no account with this email address.")
    
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)
    await user.save()
    
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    
    print(f"\n==================================================")
    print(f"PASSWORD RESET LINK FOR {body.email}:")
    print(f"{reset_link}")
    print(f"==================================================\n")
    
    success = send_reset_email(body.email, reset_link)
    
    return {
        "success": True,
        "message": "Password reset link sent to your email." if success else "Failed to send reset email. Reset link printed to console."
    }


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    user = await User.find_one(
        User.reset_token == body.token,
        User.reset_token_expires_at > datetime.utcnow()
    )
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    hashed = ph.hash(body.new_password)
    user.password = hashed
    user.reset_token = None
    user.reset_token_expires_at = None
    await user.save()
    
    return {
        "success": True,
        "message": "Password has been reset successfully."
    }


@router.post("/google")
async def google_login(body: dict):
    credential = body.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Google credential token is required")
        
    payload = await verify_google_token(credential)
    email = payload.get("email")
    first_name = payload.get("given_name", "Google")
    last_name = payload.get("family_name", "User")
    
    if not email:
        raise HTTPException(status_code=400, detail="Google token does not contain an email address")
        
    user = await User.find_one(User.email == email)
    if not user:
        import secrets
        dummy_password = ph.hash(secrets.token_urlsafe(16))
        user = User(
            email=email,
            password=dummy_password,
            phone="254700000000",
            first_name=first_name,
            last_name=last_name,
            business_name="",
            is_verified=True,
        )
        await user.insert()
        
    tokens = generate_tokens(str(user.id), "user")
    return {
        "success": True,
        "data": {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "phone": user.phone,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "businessName": user.business_name,
                "role": "user",
            },
            **tokens,
        },
    }
