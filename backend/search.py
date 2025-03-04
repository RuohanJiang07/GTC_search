import os
import json
import numpy as np
import pandas as pd
from numpy.linalg import norm
from rapidfuzz import process
from dotenv import load_dotenv
from openai import AzureOpenAI

# 🔹 Load environment variables from .env
load_dotenv()

# 🔹 Initialize Azure OpenAI client
client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-07-01-preview"),  # Default version if not set
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)

# 🔹 Load CSV with stored embeddings
csv_file = "gtc_2025_event_speakers_with_embeddings.csv"
df = pd.read_csv(csv_file)

# Convert JSON string embeddings to NumPy arrays
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

# 🔹 Semantic search function (using Azure OpenAI embeddings)
def semantic_search(query, top_k=5):
    try:
        response = client.embeddings.create(
            input=query, 
            model="text-embedding-3-small"  # Ensure this matches your Azure deployment
        )
        query_embedding = np.array(response.data[0].embedding)
        
        # Compute cosine similarity
        df["similarity"] = df["embedding"].apply(lambda emb: cosine_similarity(query_embedding, emb))
        
        return df.nlargest(top_k, "similarity")[["full_name", "title", "company", "bio", "linkedin_url", "sessions", "photo_url", "similarity"]]
    except Exception as e:
        print(f"❌ Error during semantic search: {e}")
        return pd.DataFrame()

# 🔹 Main function: Hybrid search
def search_speakers(query, top_k=5):
    name_match = fuzzy_name_search(query)
    if name_match is not None:
        print("🔍 Found by name match!")
        return pd.DataFrame([name_match])
    
    print("🤖 Running semantic search...")
    return semantic_search(query, top_k)
