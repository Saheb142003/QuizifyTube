# quizzify.py

import sys
import requests
import json
from dotenv import load_dotenv
import os

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY_QUIZ")
MODEL = os.getenv("MODEL_QUIZ")  # or MODEL_QUIZ depending on file



def query_openrouter(prompt):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7
    }

    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        return response.json()['choices'][0]['message']['content']
    else:
        return json.dumps({"error": response.text})


def generate_quiz(summary_text, num_questions, difficulty):
    topic_prompt = f"Extract 3 to 5 main topics from this summarized text:\n\n{summary_text}"
    topics = query_openrouter(topic_prompt)

    quiz_prompt = f"""
Using the following summary and topics, generate {num_questions} multiple-choice quiz questions.
Each question must be of {difficulty} level, and must include 4 options (A, B, C, D) and the correct answer.

Format like:
Q1. Question?
A. Option 1
B. Option 2
C. Option 3
D. Option 4
Answer: A

Summarized Text:
{summary_text}

Topics:
{topics}
"""
    return query_openrouter(quiz_prompt)

if __name__ == "__main__":
    summary = sys.argv[1]
    num_q = int(sys.argv[2])
    difficulty = sys.argv[3]
    result = generate_quiz(summary, num_q, difficulty)
    print(json.dumps({"quiz": result}))
