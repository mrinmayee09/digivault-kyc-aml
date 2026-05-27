# app/api/routes/auth.py
"""
POST /api/auth/signup  — register a new user
POST /api/auth/login   — authenticate and get JWT
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

VALID_ROLES = {"user", "analyst", "regulator"}


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """
    Creates a new account.
    Password is bcrypt-hashed before storage.
    Returns a JWT so the frontend can proceed without a second login call.
    """
    if payload.role not in VALID_ROLES:
        raise HTTPException(400, detail=f"Invalid role. Choose from: {VALID_ROLES}")

    # Check for duplicate email
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, detail="Email already registered.")

    user = User(
        full_name     = payload.full_name,
        email         = payload.email,
        password_hash = hash_password(payload.password),
        role          = payload.role,
        kyc_status    = "PENDING",
        step_profile_created = True,  # signing up = profile created
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        kyc_status=user.kyc_status  # Added kyc_status here
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates with email + password + expected role.
    Fails if:
      - email not found
      - password wrong
      - role in DB doesn't match the role the portal sent
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, detail="Incorrect email or password.")

    if user.role != payload.role:
        raise HTTPException(
            403,
            detail=f"This account is registered as '{user.role}', "
                   f"not '{payload.role}'. Please use the correct portal."
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        kyc_status=user.kyc_status  # Added kyc_status here
    )