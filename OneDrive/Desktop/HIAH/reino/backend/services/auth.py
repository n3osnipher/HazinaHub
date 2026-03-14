"""
Reino - Authentication Service
JWT tokens, password hashing, current user dependency
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from config import settings
from models import User

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    payload = {"sub": user_id, "exp": expire, "iat": datetime.utcnow()}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except JWTError:
        return None


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user_id = decode_token(token)
    if not user_id:
        raise credentials_exc
    user = await User.find_one(User.id == user_id)
    if not user or not user.is_active:
        raise credentials_exc
    return user


async def get_optional_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[User]:
    if not token:
        return None
    try:
        return await get_current_user(token)
    except HTTPException:
        return None
