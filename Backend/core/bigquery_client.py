from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path
import os
import pandas as pd

import json

class BigQueryClient:
    def __init__(self):
        # Use env var for Project ID, fallback to hardcoded (or better, raise error if missing in prod)
        self.project_id = os.getenv('GOOGLE_CLOUD_PROJECT', 'carbide-ratio-437111-t4')
        self.dataset_id = 'trends_data'
        self.table_id = 'skills_demand'
        self.client = self._get_client()

    def _get_client(self):
        # 1. Try Environment Variable (Production / Deployment)
        creds_json_str = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        if creds_json_str:
            try:
                creds_dict = json.loads(creds_json_str)
                credentials = service_account.Credentials.from_service_account_info(creds_dict)
                return bigquery.Client(credentials=credentials, project=self.project_id)
            except json.JSONDecodeError:
                print("Error: GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON.")
                return None

        # 2. Fallback to local file (Development)
        current_dir = Path(__file__).parent.parent
        creds_path = current_dir / "service-account.json"
        
        if not creds_path.exists():
            print(f"Warning: service-account.json not found at {creds_path} and no Env Var set.")
            return None
            
        credentials = service_account.Credentials.from_service_account_file(str(creds_path))
        return bigquery.Client(credentials=credentials, project=self.project_id)

    def load_data(self, df: pd.DataFrame):
        """Loads a pandas DataFrame into BigQuery."""
        if not self.client:
            raise Exception("BigQuery client not initialized (missing credentials?)")
            
        full_table_id = f"{self.project_id}.{self.dataset_id}.{self.table_id}"
        
        job_config = bigquery.LoadJobConfig(
            # Append to history, or WRITE_TRUNCATE if we want fresh every time.
            # For "Trends history", we might want to keep adding? 
            # But duplicate data is bad. Let's assume we are resyncing the whole 5-year view for now.
            write_disposition="WRITE_TRUNCATE", 
            autodetect=True,
        )

        job = self.client.load_table_from_dataframe(
            df, full_table_id, job_config=job_config
        )
        job.result()  # Wait for the job to complete.
        print(f"Loaded {job.output_rows} rows into {full_table_id}.")

    def query_viability_stats(self):
        """
        Runs SQL analysis to determine viability stats:
        - Avg Interest (Popularity)
        - Std Dev (Volatility/Risk)
        - Slope (Growth Trend - simplified proxy)
        """
        if not self.client:
            return []

        # Complex SQL to crunch numbers
        # We calculate standard dev and average. 
        # For 'Growth', we'll compare the Avg of the LAST 6 months vs the FIRST 6 months of the period
        sql = f"""
        WITH stats AS (
            SELECT 
                keyword,
                AVG(interest_value) as avg_interest,
                STDDEV(interest_value) as volatility,
                -- Simple growth metric: Avg of recent vs old
                -- (Note: This assumes we have date present. We need to ensure 'date' is stored)
                AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH) THEN interest_value END) as recent_avg,
                AVG(CASE WHEN date <= DATE_ADD((SELECT MIN(date) FROM `{self.project_id}.{self.dataset_id}.{self.table_id}`), INTERVAL 6 MONTH) THEN interest_value END) as old_avg
            FROM `{self.project_id}.{self.dataset_id}.{self.table_id}`
            GROUP BY keyword
        )
        SELECT 
            keyword,
            avg_interest,
            volatility,
            (recent_avg - old_avg) as growth_delta,
            CASE 
                WHEN volatility > 20 AND avg_interest < 40 THEN 'Fad / Risky'
                WHEN avg_interest > 50 AND volatility < 15 THEN 'Long-Term Staple'
                WHEN (recent_avg - old_avg) > 15 THEN 'Emerging High-Growth'
                ELSE 'Stable / Niche'
            END as category
        FROM stats
        ORDER BY avg_interest DESC
        """
        
        query_job = self.client.query(sql)
        return [dict(row) for row in query_job]
