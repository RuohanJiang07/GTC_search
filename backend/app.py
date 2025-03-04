import json
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import search  # Import search functions
import sqlite3
from datetime import datetime

# 🔹 Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://gtc-search-tqnh.onrender.com"}})

# Initialize SQLite database for tracking IP-based searches
def init_db():
    conn = sqlite3.connect('search_limits.db')
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS search_history (
        ip_address TEXT,
        search_count INTEGER,
        last_updated TEXT,
        PRIMARY KEY (ip_address)
    )
    ''')
    conn.commit()
    conn.close()

# Run database initialization
init_db()

# Function to get/update search count for an IP address
def track_search(ip_address):
    conn = sqlite3.connect('search_limits.db')
    cursor = conn.cursor()
    
    # Get current search count
    cursor.execute('SELECT search_count FROM search_history WHERE ip_address = ?', (ip_address,))
    result = cursor.fetchone()
    
    # If IP exists, increment count, otherwise create new record
    if result:
        current_count = result[0]
        new_count = current_count + 1
        cursor.execute(
            'UPDATE search_history SET search_count = ?, last_updated = ? WHERE ip_address = ?',
            (new_count, datetime.now().isoformat(), ip_address)
        )
    else:
        cursor.execute(
            'INSERT INTO search_history (ip_address, search_count, last_updated) VALUES (?, ?, ?)',
            (ip_address, 1, datetime.now().isoformat())
        )
    
    conn.commit()
    conn.close()
    
    # Return updated count
    return result[0] + 1 if result else 1

# Function to get remaining searches for an IP
def get_remaining_searches(ip_address, max_searches=100):
    conn = sqlite3.connect('search_limits.db')
    cursor = conn.cursor()
    
    cursor.execute('SELECT search_count FROM search_history WHERE ip_address = ?', (ip_address,))
    result = cursor.fetchone()
    
    conn.close()
    
    if result:
        used_searches = result[0]
        return max(0, max_searches - used_searches)
    else:
        return max_searches  # User hasn't performed any searches yet

# ✅ Function to clean and format session links properly (NOW INCLUDING ROLE)
def format_sessions(session_text):
    if not session_text:
        return []
    
    sessions = session_text.split(" | ")
    formatted_sessions = []
    
    for session in sessions:
        # Extract title, role, and URL separately
        title_and_role, url_part = session.rsplit(" - [🔗 Session Link](", 1) if " - [🔗 Session Link](" in session else (session, None)
        
        # Extract role if present (assuming it's at the end inside parentheses)
        if "(" in title_and_role and ")" in title_and_role:
            title, role = title_and_role.rsplit(" (", 1)
            role = role.rstrip(")")
        else:
            title, role = title_and_role, None
        
        # Clean URL
        url = url_part.rstrip(")") if url_part else None
        
        formatted_sessions.append({
            "title": title.strip(),
            "role": role.strip() if role else None,  # Include session role
            "url": url
        })
    
    return formatted_sessions

# 🔹 New endpoint to check remaining searches
@app.route('/remaining-searches', methods=['GET'])
def check_remaining_searches():
    # Get client IP address
    ip_address = request.remote_addr
    
    # For local development/testing, you might want to use a specific header
    if request.headers.get('X-Forwarded-For'):
        ip_address = request.headers.get('X-Forwarded-For')
    
    remaining = get_remaining_searches(ip_address)
    return jsonify({"remaining_searches": remaining})

# 🔹 Search API Endpoint
@app.route('/search', methods=['POST'])
def search_speakers_api():
    try:
        data = request.get_json()
        query = data.get("query", "").strip()
        top_k = data.get("top_k", 5)  # Default top_k to 5 if not provided

        if not query:
            return jsonify({"error": "Query is required"}), 400

        # Get client IP address
        ip_address = request.remote_addr
        
        # For local development/testing, you might want to use a specific header
        if request.headers.get('X-Forwarded-For'):
            ip_address = request.headers.get('X-Forwarded-For')
        
        # Check remaining searches
        remaining_searches = get_remaining_searches(ip_address)
        
        if remaining_searches <= 0:
            return jsonify({
                "error": "Search limit reached",
                "message": "You have reached your maximum number of searches"
            }), 429  # Too Many Requests status code

        print(f"\n🔎 Received search query: {query} from IP: {ip_address}\n")

        # Run search from search.py
        results_df = search.search_speakers(query, top_k)

        # Track this search
        track_search(ip_address)
        
        # Get updated remaining searches
        updated_remaining = get_remaining_searches(ip_address)

        # ✅ Replace NaN with None (which translates to null in JSON)
        results_df = results_df.where(pd.notna(results_df), None)

        # ✅ Apply session formatting before conversion to JSON
        if "sessions" in results_df.columns:
            results_df["sessions"] = results_df["sessions"].apply(format_sessions)

        # Convert DataFrame to JSON format
        results_json = results_df.to_dict(orient="records")

        response_data = {
            "results": results_json,
            "remaining_searches": updated_remaining
        }

        print("🔹 Sending JSON response:", json.dumps(response_data, indent=2, default=str))

        # ✅ Ensure proper JSON response, **not** a string
        return jsonify(response_data), 200

    except Exception as e:
        print("❌ Error processing search request:", str(e))
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500


# 🔹 Run Flask app
if __name__ == '__main__':
    app.run(debug=True)