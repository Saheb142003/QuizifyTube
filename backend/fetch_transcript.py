import sys
import json
import re
from urllib.parse import urlparse, parse_qs
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable
)

def get_video_id(youtube_url):
    parsed_url = urlparse(youtube_url)
    if parsed_url.hostname in ['www.youtube.com', 'youtube.com']:
        query = parse_qs(parsed_url.query)
        if 'v' in query:
            return query['v'][0]
        else:
            raise ValueError("No video ID found in URL.")
    elif parsed_url.hostname == 'youtu.be':
        return parsed_url.path[1:]
    else:
        raise ValueError("Invalid YouTube URL")

def remove_emojis(text):
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"
        "\U0001F300-\U0001F5FF"
        "\U0001F680-\U0001F6FF"
        "\U0001F1E0-\U0001F1FF"
        "\U00002500-\U00002BEF"
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "]+",
        flags=re.UNICODE
    )
    return emoji_pattern.sub(r'', text)

def fetch_transcript(youtube_url, lang='en'):
    try:
        video_id = get_video_id(youtube_url)
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=[lang])
        
        lines = [
            remove_emojis(entry['text']).strip()
            for entry in transcript
            if entry['text'].strip()
        ]

        if not lines:
            print(json.dumps({"error": "Sorry, the video doesn't have any subtitles."}, ensure_ascii=False))
        else:
            print(json.dumps(lines, ensure_ascii=False))

    except VideoUnavailable:
        print(json.dumps({"error": "Video is unavailable"}, ensure_ascii=False))
    except TranscriptsDisabled:
        print(json.dumps({"error": "Transcripts are disabled for this video"}, ensure_ascii=False))
    except NoTranscriptFound:
        print(json.dumps({"error": "No transcript found for this video"}, ensure_ascii=False))
    except ValueError as ve:
        print(json.dumps({"error": str(ve)}, ensure_ascii=False))
    except Exception as e:
        if "429" in str(e):
            print(json.dumps({"error": "YouTube is rate limiting you (429 Too Many Requests). Try again later."}, ensure_ascii=False))
        else:
            print(json.dumps({"error": f"Unhandled error: {str(e)}"}, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No URL provided"}, ensure_ascii=False))
    else:
        fetch_transcript(sys.argv[1])
