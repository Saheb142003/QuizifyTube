# summarizer.py

import sys
import requests
import json

# --- CONFIG ---
from dotenv import load_dotenv
import os

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY_SUMMARY")
MODEL = os.getenv("MODEL_SUMMARY")  # or MODEL_QUIZ depending on file

def summarize_with_openrouter(text, word_limit=70):
    prompt = f"Summarize the following text in about {word_limit} words in a listwise and topic-wise manner:\n\n{text}"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "HTTP-Referer": "https://chat.openrouter.ai",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)

    if response.status_code == 200:
        return {"summary": response.json()["choices"][0]["message"]["content"]}
    else:
        return {"error": f"API error: {response.status_code} - {response.text}"}


if __name__ == "__main__":
    try:
        text = sys.argv[1]
        word_limit = int(sys.argv[2]) if len(sys.argv) > 2 else 70
        result = summarize_with_openrouter(text, word_limit)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
