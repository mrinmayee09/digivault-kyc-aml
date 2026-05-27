# app/api/routes/aml.py
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.services.aml_service import score_transaction, AML_FLAG_THRESHOLD
from app.services import voice_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["aml"])


# app/api/routes/aml.py

@router.post("/api/simulate-txn")
def simulate_transaction(
    payload: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id        = payload.get("user_id") or current_user["user_id"]
    amount         = payload.get("amount")
    receiver_name  = payload.get("receiver_name", "").strip()
    account_number = payload.get("account_number", "").strip()

    if not amount or float(amount) <= 0:
        raise HTTPException(400, detail="amount must be a positive number.")
    if not receiver_name:
        raise HTTPException(400, detail="receiver_name is required.")
    if not account_number:
        raise HTTPException(400, detail="account_number is required.")

    # 🔒 NEW SECURITY BLOCK: Enforce KYC Verification
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found.")
    if user.kyc_status != "VERIFIED":
        raise HTTPException(403, detail="Transaction Blocked: KYC verification is incomplete or pending analyst review.")

    # ... keep the rest of your code (Load history, Score with Random Forest, etc.) exactly the same ...

    # Load history
    history = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .limit(200)
        .all()
    )

    # Score with Random Forest + New Anomaly Rules
    # We now pass the account_number so the ML service can check for repeating/trailing digits!
    result        = score_transaction(float(amount), history, account_number)
    anomaly_score = result["anomaly_score"]
    is_flagged    = result["is_flagged"]
    status        = "PENDING" if is_flagged else "APPROVED"

    # Save to DB with exact UTC timestamp for precise frontend display
    txn = Transaction(
        user_id=user_id,
        receiver_name=receiver_name,
        account_number=account_number,
        amount=float(amount),
        anomaly_score=anomaly_score,
        is_flagged=is_flagged,
        status=status,
        created_at=datetime.now(timezone.utc)
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    if is_flagged:
        voice_service.speak(voice_service.ANOMALY_DETECTED)
        logger.warning(
            "FLAGGED: user=%d amount=%.2f score=%.4f method=%s rule=%s",
            user_id, amount, anomaly_score,
            result.get("method"), result.get("rule_triggered")
        )

    return {
        "transaction_id": txn.id,
        "anomaly_score":  txn.anomaly_score,
        "is_flagged":     txn.is_flagged,
        "status":         txn.status,
        "method":         result.get("method"),
        "rule_triggered": result.get("rule_triggered"),
        "message": (
            f"Transaction flagged for analyst review. Score: {anomaly_score:.2f}"
            if is_flagged else
            f"Transaction approved. Score: {anomaly_score:.2f}"
        ),
    }


@router.get("/api/transactions")
def get_transactions(
    user_id: int = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = user_id or current_user["user_id"]
    
    # Generate this user's unique receiving account number
    my_account_number = f"98765432100{uid}"
    
    # Fetch transactions where they are EITHER the sender OR the receiver
    txns = (
        db.query(Transaction)
        .filter((Transaction.user_id == uid) | (Transaction.account_number == my_account_number))
        .order_by(Transaction.created_at.desc())
        .all()
    )
    
    # NEW: Fetch the full names of all the people who sent these transactions
    sender_ids = {t.user_id for t in txns}
    senders = db.query(User).filter(User.id.in_(sender_ids)).all()
    sender_map = {u.id: u.full_name for u in senders}
    
    return {
        "transactions": [
            {
                "transaction_id": t.id,
                "sender_id":      t.user_id,
                "sender_name":    sender_map.get(t.user_id, "Unknown System"), # Gets the sender's real name
                "receiver_name":  t.receiver_name,
                "account_number": t.account_number,
                "amount":         t.amount,
                "anomaly_score":  t.anomaly_score,
                "is_flagged":     t.is_flagged,
                "status":         t.status,
                "created_at":     t.created_at.isoformat() if t.created_at else None,
            }
            for t in txns
        ]
    }