import time
import requests
import threading
import os

# Render URL from environment or hardcoded fallback
RENDER_URL = os.getenv("RENDER_EXTERNAL_URL", "https://career-coach-ai-3xap.onrender.com")

def ping_server():
    while True:
        try:
            # Ping every 10 minutes (Render sleeps after 15 mins of inactivity)
            time.sleep(10 * 60)
            
            print(f"⏰ Keep-Alive: Pinging {RENDER_URL}...")
            response = requests.get(f"{RENDER_URL}/ping")
            
            if response.status_code == 200:
                print("✅ Keep-Alive: Ping successful.")
            else:
                print(f"⚠️ Keep-Alive: Ping returned status {response.status_code}")
                
        except Exception as e:
            print(f"❌ Keep-Alive: Ping failed: {e}")

def start_keep_alive():
    """Starts the keep-alive pinger in a background thread."""
    # Only start if we are running in a production-like environment (not just local reload)
    # But for simplicity, we start it always, just to be safe.
    print("🚀 Starting Keep-Alive Background Service...")
    thread = threading.Thread(target=ping_server, daemon=True)
    thread.start()
