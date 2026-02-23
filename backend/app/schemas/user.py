from pydantic import BaseModel, field_validator
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    password: str
    
    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        if not v or len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v.lower().strip()
    
    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if not v or len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int | None = None
