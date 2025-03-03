import openai
import pandas as pd
import json
import numpy as np
from numpy.linalg import norm
from rapidfuzz import process
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

# 🔹 Load CSV with stored embeddings
csv_file = "gtc_2025_event_speakers_with_embeddings.csv"
df = pd.read_csv(csv_file)
df["embedding"] = df["embedding"].apply(lambda x: np.array(json.loads(x)))

# 🔹 Cosine similarity function
def cosine_similarity(vec1, vec2):
    return np.dot(vec1, vec2) / (norm(vec1) * norm(vec2))

# 🔹 Fuzzy name search
def fuzzy_name_search(query, threshold=85):
    names = df["full_name"].tolist()
    match, score, _ = process.extractOne(query, names)
    if score >= threshold:
        return df[df["full_name"] == match].iloc[0]
    return None

# 🔹 Semantic search function
def semantic_search(query, top_k=5):
    try:
        response = openai.embeddings.create(input=query, model="text-embedding-3-small")
        query_embedding = np.array(response.data[0].embedding)
        df["similarity"] = df["embedding"].apply(lambda emb: cosine_similarity(query_embedding, emb))
        return df.nlargest(top_k, "similarity")[["full_name", "title", "company", "bio", "linkedin_url", "sessions", "photo_url", "similarity"]]
    except Exception as e:
        print(f"Error during semantic search: {e}")
        return pd.DataFrame()

# 🔹 Main function: Hybrid search
def search_speakers(query, top_k=5):
    name_match = fuzzy_name_search(query)
    if name_match is not None:
        print("🔍 Found by name match!")
        return pd.DataFrame([name_match])
    
    print("🤖 Running semantic search...")
    return semantic_search(query, top_k)
