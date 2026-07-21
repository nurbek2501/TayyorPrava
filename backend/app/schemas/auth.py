"""Authentication schemas."""
from datetime import datetime
from typing import Optional

from pydantic import Field

from app.schemas.common import CamelModel


class RegisterRequest(CamelModel):
    first_name: str = Field(min_length=1, max_length=255)
    last_name: str = Field(min_length=1, max_length=255)
    nickname: str = Field(min_length=8, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    ref: Optional[str] = None  # referral code of inviter


class RegisterInitResponse(CamelModel):
    ok: bool = True
    nickname: str
    bot_username: str
    channel: str


class VerifyCodeRequest(CamelModel):
    nickname: str
    code: str = Field(min_length=4, max_length=6)


class OkResponse(CamelModel):
    ok: bool = True


class ResetPasswordRequest(CamelModel):
    nickname: str
    code: str = Field(min_length=4, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(CamelModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


class CheckPromoRequest(CamelModel):
    code: str


class CheckPromoResponse(CamelModel):
    valid: bool
    name: Optional[str] = None  # taklif egasi (inviter) ismi


class CodeStatusRequest(CamelModel):
    nickname: str


class CodeStatusResponse(CamelModel):
    active: bool
    # Kod tugashiga qolgan soniya (timezone muammosisiz — saytda teskari sanoq uchun)
    remaining_seconds: int = 0
    purpose: Optional[str] = None


class BotIssueCodeRequest(CamelModel):
    nickname: str
    telegram_id: Optional[str] = None


class BotIssueCodeResponse(CamelModel):
    ok: bool = True
    code: str
    purpose: str
    expires_at: datetime
    first_name: Optional[str] = None


class LoginRequest(CamelModel):
    nickname: str
    password: str


class CheckNicknameRequest(CamelModel):
    nickname: str


class CheckNicknameResponse(CamelModel):
    available: bool
    error: Optional[str] = None


class AdminLoginRequest(CamelModel):
    login: str
    password: str


class AdminUpdateCredentialsRequest(CamelModel):
    current_password: str
    new_login: Optional[str] = None
    new_password: Optional[str] = None


class AdminCredentialsResponse(CamelModel):
    ok: bool = True
    login: str


class RefreshRequest(CamelModel):
    refresh_token: str


class TokenResponse(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
