from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
import pandas as pd
from pytrends.request import TrendReq
from dependencies import get_db_manager, get_current_user
from core.db_core import DatabaseManager
from core.ai_core import generate_skill_trends_analysis
from core.bigquery_client import BigQueryClient
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
        keywords = SKILLS_TO_TRACK[:5] 
        logger.info(f"Fetching trends for: {keywords}")
        
        # success: build payload
        pytrends.build_payload(keywords, cat=0, timeframe='today 12-m', geo='', gprop='')
        
        # get interest over time
        data_df = pytrends.interest_over_time()
        
        if data_df.empty:
            raise Exception("Empty dataframe returned from Google Trends API")

        # Process data for frontend
        data_df = data_df.reset_index()
        # Get the latest row (or second to last if current is incomplete)
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
        # Return realistic mock data on failure (Rate Limit / IP Block)
        logger.warning("Using MOCK data due to API failure.")
        return {
            "success": True, 
            "source": "mock",
            "warning": "Real-time data unavailable (Rate Limit). Showing demo data.",
            "data": [
                {"keyword": "React", "interest_value": 85, "date": "2024-01-01"},
                {"keyword": "Python", "interest_value": 92, "date": "2024-01-01"},
                {"keyword": "Machine Learning", "interest_value": 78, "date": "2024-01-01"},
                {"keyword": "Java", "interest_value": 65, "date": "2024-01-01"},
                {"keyword": "Docker", "interest_value": 70, "date": "2024-01-01"}
            ] 
        }

@router.post("/sync")
async def sync_trends_to_bigquery():
    """
    Triggers the ETL process: Fetch 5 years of history (or generate synthetic) and load to BigQuery.
    """
    df = None
    keywords = SKILLS_TO_TRACK[:5]
    
    # 1. Try Fetching Real Data
    try:
        pytrends = TrendReq(hl='en-US', tz=360)
        logger.info(f"Starting sync for: {keywords}")
        pytrends.build_payload(keywords, cat=0, timeframe='today 5-y', geo='', gprop='')
        df = pytrends.interest_over_time()
        
        if df.empty:
            raise Exception("Google Trends returned empty data")
            
        if 'date' not in df.columns:
            df = df.reset_index()
            
    except Exception as e:
        logger.warning(f"Google Trends Sync Failed ({e}). Generating SYNTHETIC data for BigQuery demo.")
        
        # 2. Fallback: Generate Synthetic Data
        import pandas as pd
        import numpy as np
        
        # Create 5 years of weekly dates
        dates = pd.date_range(end=pd.Timestamp.now(), periods=260, freq='W') 
        mock_data = {'date': dates}
        
        for kw in keywords:
            # Generate somewhat realistic trends with randomness
            base_trend = np.linspace(20, 80, len(dates)) # Slowly rising trend
            noise = np.random.randint(-15, 15, len(dates))
            trend_line = base_trend + noise
            trend_line = np.clip(trend_line, 0, 100) # Keep within 0-100
            mock_data[kw] = trend_line.astype(int)
            
        df = pd.DataFrame(mock_data)

    # 3. Transform for BigQuery (Flat Format)
    if df is None or df.empty:
         return {"success": False, "message": "Failed to acquire data (Real or Synthetic)."}

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
    
    bq_df = pd.DataFrame(rows)
    
    # 4. Load to BigQuery
    try:
        bq_client = BigQueryClient()
        if not bq_client.client:
             return {"success": True, "message": "Sync processing complete (BigQuery not configured - skipped load).", "rows_processed": len(bq_df)}
             
        bq_client.load_data(bq_df)
        return {"success": True, "message": f"Successfully loaded {len(bq_df)} rows into BigQuery."}
        
    except Exception as e:
        logger.error(f"BigQuery Load Failed: {e}")
        return {"success": False, "message": f"BigQuery Load Failed: {str(e)}"}

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
