# app/services/aml_service.py
"""
AML Detection using Random Forest + SMOTE.

Based on:
- Jigalur et al. (IEEE ICDDS 2024): Random Forest achieves 99.9% accuracy for AML
- Shah et al. (IEEE SATC 2025): SMOTE fixes class imbalance in financial datasets
"""
import logging
import re
from datetime import datetime, timedelta, timezone

import numpy as np

logger = logging.getLogger(__name__)

AML_FLAG_THRESHOLD = 0.70
MIN_HISTORY_FOR_ML = 5

def is_suspicious_account(acc_num: str) -> bool:
    """Matches 5 repeating digits (e.g., 66666) or ending in 4+ zeros (e.g., 0000)."""
    if not acc_num: return False
    if re.search(r'(.)\1{4,}', acc_num) or re.search(r'0{4,}$', acc_num):
        return True
    return False


def _extract_features(amount: float, ts: datetime, history: list) -> np.ndarray:
    amounts = [t.amount for t in history] if history else []
    avg_amt = np.mean(amounts) if amounts else amount
    max_amt = np.max(amounts)  if amounts else amount
    std_amt = np.std(amounts)  if amounts else 0.0

    cutoff = ts - timedelta(hours=24)
    velocity_24h = 0
    
    # Timezone normalizer to prevent offset crashes during ML extraction
    if history:
        for t in history:
            if t.created_at:
                t_time = t.created_at
                if t_time.tzinfo is None and ts.tzinfo is not None:
                    t_time = t_time.replace(tzinfo=timezone.utc)
                if t_time >= cutoff:
                    velocity_24h += 1

    return np.array([
        float(amount),
        float(np.log1p(amount)),
        float(ts.hour),
        float(ts.weekday()),
        float(velocity_24h),
        float(amount / avg_amt) if avg_amt > 0 else 1.0,
        float(amount / max_amt) if max_amt > 0 else 1.0,
        float((amount - avg_amt) / std_amt) if std_amt > 0 else 0.0,
    ])


def score_transaction(amount: float, history: list, account_number: str = "") -> dict:
    now = datetime.now(timezone.utc)
    rule_triggered = None

    # Check for anomalies immediately
    if is_suspicious_account(account_number):
        rule_triggered = "Suspicious Account Number Pattern"
    elif 1 <= now.hour <= 5:
        rule_triggered = "Late Night Transaction (1 AM - 5 AM)"

    # Rule-Based Fallback for New Users (< 5 transactions)
    if len(history) < MIN_HISTORY_FOR_ML:
        result = _rule_based(amount, history)
        if rule_triggered:
            # Force the score to a minimum of 0.85 if a rule triggered
            result["anomaly_score"] = max(0.85, result["anomaly_score"] + 0.40)
            result["is_flagged"] = result["anomaly_score"] > AML_FLAG_THRESHOLD
            result["rule_triggered"] = rule_triggered
        return result

    # Machine Learning Path
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler

        amounts  = [t.amount for t in history]
        mean_a   = np.mean(amounts)
        std_a    = np.std(amounts)
        threshold = mean_a + 2 * std_a if std_a > 0 else mean_a * 3

        X = np.array([
            _extract_features(t.amount, t.created_at or now, history[i+1:])
            for i, t in enumerate(history)
        ])
        y = np.array([1 if t.amount > threshold else 0 for t in history])

        if y.sum() == 0:
            y[np.argmax(amounts)] = 1

        if len(X) >= 10:
            try:
                from imblearn.over_sampling import SMOTE
                sm = SMOTE(
                    k_neighbors=min(3, int(y.sum()) - 1) if y.sum() > 1 else 1,
                    random_state=42
                )
                X, y = sm.fit_resample(X, y)
            except Exception as e:
                logger.warning("SMOTE skipped: %s", e)

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        clf = RandomForestClassifier(
            n_estimators=100,
            max_depth=6,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )
        clf.fit(X_scaled, y)

        x_new = _extract_features(amount, now, history).reshape(1, -1)
        x_new_scaled = scaler.transform(x_new)

        fraud_prob = float(clf.predict_proba(x_new_scaled)[0][1])

        if std_a > 0 and amount > mean_a + 3 * std_a:
            fraud_prob = min(1.0, fraud_prob + 0.15)

        # APPLY THE NEW ANOMALY RULES TO ML SCORE (GUARANTEED FLAGGING)
        if rule_triggered:
            fraud_prob = max(0.85, fraud_prob + 0.40)

        anomaly_score = round(float(np.clip(fraud_prob, 0.0, 1.0)), 4)
        is_flagged    = anomaly_score > AML_FLAG_THRESHOLD

        return {
            "anomaly_score":  anomaly_score,
            "is_flagged":     is_flagged,
            "method":         "random_forest",
            "rule_triggered": rule_triggered,
        }

    # Ultimate Fallback (If ML fails for any reason)
    except Exception as e:
        logger.error("Random Forest scoring failed, using rules: %s", e)
        result = _rule_based(amount, history)
        
        # Ensure penalties still apply even if the ML engine gracefully crashes
        if rule_triggered:
            result["anomaly_score"] = max(0.85, result["anomaly_score"] + 0.40)
            result["is_flagged"] = result["anomaly_score"] > AML_FLAG_THRESHOLD
            result["rule_triggered"] = rule_triggered
            
        return result


def _rule_based(amount: float, history: list) -> dict:
    amounts = [t.amount for t in history] if history else []
    avg     = np.mean(amounts) if amounts else 0
    rule    = None
    score   = 0.10

    if amount >= 1_000_000:
        score, rule = 0.95, "Amount >= ₹10 lakh"
    elif amount >= 500_000:
        score, rule = 0.82, "Amount >= ₹5 lakh"
    elif amount >= 200_000:
        score, rule = 0.65, "Amount >= ₹2 lakh"
    elif avg > 0 and amount > avg * 5:
        score, rule = 0.78, f"Amount is 5x user average (avg: ₹{avg:,.0f})"
    elif avg > 0 and amount > avg * 3:
        score, rule = 0.60, f"Amount is 3x user average (avg: ₹{avg:,.0f})"

    return {
        "anomaly_score":  round(score, 4),
        "is_flagged":     score > AML_FLAG_THRESHOLD,
        "method":         "rule_based",
        "rule_triggered": rule,
    }