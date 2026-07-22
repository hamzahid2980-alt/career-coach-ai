from datetime import datetime, timezone
from fastapi import HTTPException, Depends
from core.db_core import DatabaseManager
from dependencies import get_db_manager, get_current_user

# Global Tier Specifications
TIER_LIMITS = {
    "free": {
        "resumes_optimized": 1,   # monthly
        "roadmaps_generated": 1,  # lifetime/total
        "assessments_taken": 2,   # monthly
        "mock_interviews": 2,     # monthly
        "jobs_matched": 2,        # search allowance
        "chatbot_messages": 10,   # daily
        "emails_sent": 1,         # daily
        "portfolios_generated": 0, # Premium exclusive (not allowed in free)
        "portfolios_rated": 0      # Premium exclusive
    },
    "pro": {
        "resumes_optimized": 5,
        "roadmaps_generated": 3,
        "assessments_taken": 10,
        "mock_interviews": 10,
        "jobs_matched": 10,
        "chatbot_messages": 50,
        "emails_sent": 5,
        "portfolios_generated": 0, # Premium exclusive
        "portfolios_rated": 0      # Premium exclusive
    },
    "premium": {
        "resumes_optimized": 999999, # unlimited
        "roadmaps_generated": 999999,
        "assessments_taken": 999999,
        "mock_interviews": 999999,
        "jobs_matched": 999999,
        "chatbot_messages": 200,
        "emails_sent": 999999,
        "portfolios_generated": 999999, # Unlimited for Premium/Elite
        "portfolios_rated": 999999
    }
}

def verify_tier_limit(action: str):
    """
    Returns a dependency function that enforces subscription limits for the specified action.
    """
    async def limit_checker(
        user: dict = Depends(get_current_user),
        db: DatabaseManager = Depends(get_db_manager)
    ):
        uid = user['uid']
        
        # 1. Fetch user data to determine their tier and usage logs
        user_ref = db.db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            # Starter fallback if user record isn't in Firestore yet
            return
            
        user_data = user_doc.to_dict()
        tier = user_data.get('subscription_tier', 'free')
        
        # Verify if subscription has expired (expired -> back to free)
        expires_str = user_data.get('subscription_expires')
        if expires_str:
            try:
                expires_dt = datetime.fromisoformat(expires_str)
                # Ensure we check tz-aware vs naive correctly
                if expires_dt.tzinfo is None:
                    expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) > expires_dt:
                    tier = 'free'
                    user_ref.update({'subscription_tier': 'free'}) # Auto downgrade expired
            except Exception as e:
                print(f"[Tier] Expiry check failed, defaulting: {e}")

        limits = TIER_LIMITS.get(tier, TIER_LIMITS['free'])
        max_allowed = limits.get(action, 0)
        
        # 2. Daily limits vs Monthly limits
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        current_month_str = now.strftime("%Y-%m")
        
        usage_doc_ref = user_ref.collection('usage_logs').document(action)
        usage_doc = usage_doc_ref.get()
        usage_data = usage_doc.to_dict() if usage_doc.exists else {}

        # Reset counts if calendar window has rolled over
        if action in ['chatbot_messages', 'emails_sent']:
            # Daily reset
            if usage_data.get('last_reset_date') != today_str:
                usage_data = {'count': 0, 'last_reset_date': today_str}
        else:
            # Monthly reset (except roadmaps which is overall/lifetime)
            if action != 'roadmaps_generated':
                if usage_data.get('last_reset_month') != current_month_str:
                    usage_data = {'count': 0, 'last_reset_month': current_month_str}

        current_count = usage_data.get('count', 0)
        
        if current_count >= max_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Subscription Limit Exceeded: You have reached the maximum allowed {action.replace('_', ' ')} limit which is {max_allowed} for your current '{tier.upper()}' subscription tier. Please upgrade your plan to continue."
            )
            
        # Write temporary context variables onto the user dict so endpoints can increment usage easily
        user['usage_log_ref'] = usage_doc_ref
        user['usage_log_data'] = usage_data
        user['action_name'] = action
        user['subscription_tier'] = tier

    return limit_checker

def increment_tier_usage(user: dict):
    """
    Increments the usage log count for the verified context action.
    """
    usage_log_ref = user.get('usage_log_ref')
    usage_data = user.get('usage_log_data')
    
    if usage_log_ref is not None and usage_data is not None:
        new_count = usage_data.get('count', 0) + 1
        usage_data['count'] = new_count
        usage_log_ref.set(usage_data, merge=True)
        print(f"[Tier] Incremented usage for {user.get('action_name')} to {new_count}")
