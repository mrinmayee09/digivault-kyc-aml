from pydantic import BaseModel

class SignupRequest(BaseModel):
    email:     str
    password:  str
    full_name: str
    role:      str = "user"

class LoginRequest(BaseModel):
    email:    str
    password: str
    role:     str = "user"

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      int
    role:         str
    full_name:    str
    kyc_status:   str | None = None  # Added this line to prevent 500 errors!