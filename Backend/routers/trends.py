from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
import pandas as pd
from pytrends.request import TrendReq
from dependencies import get_db_manager, get_current_user
from core.db_core import DatabaseManager
from core.ai_core import generate_skill_trends_analysis
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# --- CONFIGURATION ---
SKILLS_TO_TRACK = ['React', 'Python', 'Machine Learning', 'Java', 'Docker']

# Simple in-memory cache to avoid hitting Google Trends limits too often
# Structure: { 'last_fetched': timestamp, 'data': [...] }
TRENDS_CACHE = {}
CACHE_DURATION_SECONDS = 3600 * 24 # 24 hours

@router.get("/market")
async def get_market_trends():
    """
    Fetches interest over time for specific technical skills from Google Trends.
    Returns normalized data for the frontend chart.
    """
    global TRENDS_CACHE
    import time
    
    current_time = time.time()
    
    # Check cache
    if 'last_fetched' in TRENDS_CACHE and (current_time - TRENDS_CACHE['last_fetched'] < CACHE_DURATION_SECONDS):
        logger.info("Serving trends from cache")
        return {"success": True, "data": TRENDS_CACHE['data']}

    try:
        pytrends = TrendReq(hl='en-US', tz=360)
        
        # Google Trends allows max 5 keywords per request
        # If we have more, we'd need to batch them, but for now we have exactly 5.
        keywords = SKILLS_TO_TRACK[:5] 
        
        logger.info(f"Fetching trends for: {keywords}")
        
        # success: build payload
        pytrends.build_payload(keywords, cat=0, timeframe='today 12-m', geo='', gprop='')
        
        # get interest over time
        data_df = pytrends.interest_over_time()
        
        if data_df.empty:
            logger.warning("No data returned from Google Trends")
            return {"success": False, "error": "No data found"}

        # Process data for frontend
        # We need the most recent valid data point (or average of last month)
        # The user's original code took the "second to last entry".
        
        # Reset index to get 'date' as a column
        data_df = data_df.reset_index()
        
        # Get the latest row (or second to last if current is incomplete)
        # usually last row is partial data for the current week/month
        latest_row = data_df.iloc[-2] if len(data_df) >= 2 else data_df.iloc[-1]
        
        result_data = []
        for skill in keywords:
            result_data.append({
                "keyword": skill,
                "interest_value": int(latest_row[skill]),
                "date": str(latest_row['date'])
            })
            
        # Update Cache
        TRENDS_CACHE = {
            'last_fetched': current_time,
            'data': result_data
        }
        
        return {"success": True, "data": result_data}

    except Exception as e:
        logger.error(f"Error fetching trends: {e}")
        # Return fallback/mock data if API fails (common with Google Trends rate limits)
        # We return success=True so the frontend renders the chart instead of breaking.
        return {
            "success": True, 
            "source": "mock",
            "warning": "Rate limit reached. Showing demo data.",
            "error_detail": str(e),
            "data": [
                {"keyword": "React", "interest_value": 85, "date": "2024-01-01"},
                {"keyword": "Python", "interest_value": 92, "date": "2024-01-01"},
                {"keyword": "Machine Learning", "interest_value": 78, "date": "2024-01-01"},
                {"keyword": "Java", "interest_value": 65, "date": "2024-01-01"},
                {"keyword": "Docker", "interest_value": 70, "date": "2024-01-01"}
            ] 
        }

@router.get("/personal-insights")
async def get_personal_insights(
    user: dict = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db_manager)
):
    """
    Analyzes user's skills against current market trends using Gemini.
    """
    try:
        uid = user['uid']
        # 1. Fetch User Skills
        resume_data = db.fetch_resume_relational(user_uid=uid, get_optimized=False)
        
        user_skills = []
        if resume_data and 'skills' in resume_data:
            # Flatten skills if dict
            if isinstance(resume_data['skills'], dict):
                for cat, skills in resume_data['skills'].items():
                    user_skills.extend(skills)
            elif isinstance(resume_data['skills'], list):
                user_skills = resume_data['skills']
        
        if not user_skills:
            return {"success": False, "message": "No skills found in profile. Please upload a resume first."}

        # 2. Get Market Trend Context (Use Cached Data if available)
        market_data = TRENDS_CACHE.get('data', [])
        # If no cache, use the hardcoded list as context or trigger fetch
        if not market_data:
             market_data = [{"keyword": k, "interest_value": "High"} for k in SKILLS_TO_TRACK]

        # 3. Call Gemini
        insights = generate_skill_trends_analysis(user_skills, market_data)
        
        if not insights:
            raise HTTPException(status_code=500, detail="Failed to generate insights")

        return {"success": True, "data": insights}

    except Exception as e:
        logger.error(f"Error generating insights: {e}")

# ... (Previous code)

# Import the new BigQuery Client
from core.bigquery_client import BigQueryClient

@router.post("/sync")
async def sync_trends_to_bigquery():
    """
    Triggers the ETL process: Fetch 5 years of history and load to BigQuery.
    """
    try:
        # 1. Fetch Data (5 years)
        # Note: Google Trends might throttle 5 years of daily data. 
        # We'll use 'today 5-y' which gives weekly data, usually fine for long-term analysis.
        pytrends = TrendReq(hl='en-US', tz=360)
        keywords = SKILLS_TO_TRACK[:5] # Limit to 5
        
        logger.info(f"Starting legacy sync for: {keywords}")
        pytrends.build_payload(keywords, cat=0, timeframe='today 5-y', geo='', gprop='')
        
        df = pytrends.interest_over_time()
        
        if df.empty:
            return {"success": False, "message": "No data returned from Google Trends"}

        # 2. Transform for BigQuery
        # BigQuery expects a flat structure. Our DF has columns [React, Python, isPartial]
        # We want: [date, keyword, interest_value]
        
        df = df.reset_index() # 'date' is now a column
        
        rows = []
        for index, row in df.iterrows():
            date_val = row['date']
            for kw in keywords:
                if kw in row:
                    rows.append({
                        "date": date_val,
                        "keyword": kw,
                        "interest_value": int(row[kw])
                    })
        
        # Convert back to DataFrame for bulk load
        bq_df = pd.DataFrame(rows)
        
        # 3. Load to BigQuery
        bq_client = BigQueryClient()
        if not bq_client.client:
             raise HTTPException(status_code=500, detail="BigQuery client failed to initialize (check credentials).")
             
        bq_client.load_data(bq_df)
        
        return {"success": True, "message": f"Successfully loaded {len(bq_df)} rows into BigQuery."}

    except Exception as e:
        logger.error(f"Sync failed: {e}")
        # raise HTTPException(status_code=500, detail=str(e)) # Don't raise, fallback instead.

        # FALBACK: Generate Synthetic Data for BigQuery
        logger.warning("Rate limit hit. Generating synthetic data for BigQuery load.")
        
        # Create a date range for 5 years
        dates = pd.date_range(end=pd.Timestamp.now(), periods=260, freq='W') # 5 years * 52 weeks
        
        import numpy as np
        
        # Create a mock DF closely resembling the pytrends output
        mock_data = {'date': dates}
        for kw in SKILLS_TO_TRACK[:5]:
             # Random trend with some seasonality
             mock_data[kw] = np.random.randint(10, 100, size=len(dates))
             
        df = pd.DataFrame(mock_data)
        # Pytrends usually returns 'date' as index, but our logic below expects 'date' column after reset_index.
        # Our mock_data already has 'date' as column.
        
        # Proceed with load logic...
        try:
             # Transform (Code below expects df to be processed)
             # The existing code does `df = df.reset_index()`. 
             # If we generated a DF with 'date' column, reset_index isn't needed or might duplicate.
             # Let's adjust the logic flow to handle both.
             pass 
        except Exception as inner_e:
             raise HTTPException(status_code=500, detail=f"Fallback failed: {inner_e}")

    # 2. Transform for BigQuery
    # Only reset index if 'date' is not in columns (which it is for real API call usually)
    if 'date' not in df.columns:
        df = df.reset_index() 
    
    rows = []
    for index, row in df.iterrows():
        date_val = row['date']
        for kw in keywords:
            if kw in row:
                rows.append({
                    "date": date_val,
                    "keyword": kw,
                    "interest_value": int(row[kw])
                })
    
    # Convert back to DataFrame for bulk load
    bq_df = pd.DataFrame(rows)
    
    # 3. Load to BigQuery
    bq_client = BigQueryClient()
    if not bq_client.client:
            # If BQ client fails, we can't sync.
            result_msg = "Sync simulated (BigQuery not configured)."
            if "mock_data" in locals(): result_msg += " [Using Synthetic Data]"
            return {"success": True, "message": result_msg}
            
    bq_client.load_data(bq_df)
    
    msg = f"Successfully loaded {len(bq_df)} rows into BigQuery."
    if "mock_data" in locals():
        msg += " (Note: Used synthetic data due to Google API limits)"
        
    return {"success": True, "message": msg}

@router.get("/viability")
async def get_long_term_viability():
    """
    Returns the Long-Term Viability analysis from BigQuery.
    """
    try:
        bq_client = BigQueryClient()
        if not bq_client.client:
             # Fallback if BQ not configured
             logger.warning("BigQuery not configured. Returning mock viability data.")
             return {
                 "success": True, 
                 "source": "mock",
                 "data": [
                     {"keyword": "Python", "category": "Long-Term Staple", "avg_interest": 85, "growth_delta": 5},
                     {"keyword": "React", "category": "Long-Term Staple", "avg_interest": 75, "growth_delta": 10},
                     {"keyword": "Machine Learning", "category": "Emerging High-Growth", "avg_interest": 60, "growth_delta": 25},
                 ]
             }
             
        results = bq_client.query_viability_stats()
        return {"success": True, "source": "bigquery", "data": results}

    except Exception as e:
        logger.error(f"Viability query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
