from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import json
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
import re
from contextlib import asynccontextmanager


vectorizer = None
model = None

aspects = {
    'acting': ['acting', 'actor', 'performance'],
    'cinematography': ['cinematography', 'visuals', 'camera', 'lighting'],
    'plot': ['plot', 'story', 'script', 'ending'],
    'soundtrack': ['soundtrack', 'music', 'score']
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global vectorizer, model
    print("Training model on startup...")
    
    # Try to load either dataset provided
    dataset_path = 'IMDB.csv'
    if not os.path.exists(dataset_path):
        dataset_path = 'IMDB_2.csv'
        
    try:
        df = pd.read_csv(dataset_path).sample(2000, random_state=42)
        df['target'] = df['sentiment'].map({'positive': 1, 'negative': 0})
        
        vectorizer = TfidfVectorizer(max_features=2000, stop_words='english')
        X = vectorizer.fit_transform(df['review'])
        y = df['target']
        
        model = LogisticRegression()
        model.fit(X, y)
        print(f"Model ready! (Trained on {dataset_path})")
    except Exception as e:
        print(f"Warning: Could not train AI model. Error: {e}")
        print("Please ensure your CSV file is in the same folder as this script.")
        
    yield 
    

    print("Shutting down API...")

app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ReviewRequest(BaseModel):
    review_text: str

@app.post("/api/analyze")
def analyze_review(req: ReviewRequest):
    """Endpoint to analyze a new review on the fly"""
    if model is None or vectorizer is None:
        raise HTTPException(status_code=503, detail="AI Model is not loaded. Check server logs.")

    sentences = re.split(r'(?<=[.!?]) +', req.review_text.lower())
    scores = {}
    
    for aspect, keywords in aspects.items():
        relevant = [s for s in sentences if any(k in s for k in keywords)]
        if not relevant:
            scores[aspect] = 50
            continue
            
        X_test = vectorizer.transform(relevant)
        probs = model.predict_proba(X_test)[:, 1]
        scores[aspect] = int(round(np.mean(probs) * 100))
        
    return {"scores": scores}

@app.get("/api/movies")
def get_movies():
    """Endpoint to return the full database"""
   
    try:
        with open('movies.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"error": "Run generate_db.py first to create movies.json"}
