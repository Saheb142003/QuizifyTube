import json
import sys
import re

def normalize_text(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', '', text)  # Remove special characters
    text = re.sub(r'\s+', ' ', text).strip()  # Remove extra whitespace
    return text

# Define weighted keywords
educational_keywords = {
    "learn": 1.5,
    "understand": 1.2,
    "explain": 1.5,
    "definition": 1.2,
    "concept": 1.2,
    "introduction": 1.2,
    "lecture": 2.0,
    "tutorial": 2.0,
    "course": 2.0,
    "how to": 2.5,
    "step by step": 2.5,
    "topic": 1.0,
    "study": 1.5,
    "class": 1.0,
    "teacher": 1.0,
    "coding": 2.0,
    "programming": 2.0,
    "science": 1.5,
    "math": 1.5,
    "physics": 1.5,
    "chemistry": 1.5,
    "data": 1.0,
    "statistics": 1.5,
    "algorithm": 2.0,
    "history": 1.5,
    "geography": 1.2,
    "education": 2.0,
    "knowledge": 1.2
}

THRESHOLD = 5  # Minimum total weight to consider educational

def analyze_transcript(transcript_lines):
    full_text = normalize_text(" ".join(transcript_lines))

    keyword_scores = {}
    total_score = 0

    for keyword, weight in educational_keywords.items():
        count = full_text.count(keyword)
        if count > 0:
            keyword_scores[keyword] = {
                "count": count,
                "weight": weight,
                "score": round(count * weight, 2)
            }
            total_score += count * weight

    return {
        "total_score": round(total_score, 2),
        "educational": total_score >= THRESHOLD,
        "keywords_matched": keyword_scores
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Transcript JSON string required"}))
        return

    try:
        transcript_lines = json.loads(sys.argv[1])
        if not isinstance(transcript_lines, list):
            raise ValueError("Transcript must be a list of strings.")

        result = analyze_transcript(transcript_lines)
        print(json.dumps(result, indent=2))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
