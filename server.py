"""
Vision AI — JARVIS Backend v3.0
=================================
Smarter than the smartest PC.
- Groq AI (Llama 3.1) with deep system prompt
- Web search via DuckDuckGo (no API key needed)
- Live weather
- Code execution sandbox
- Math engine
- Memory that grows smarter over time
- Emotion detection
- News headlines
"""

import os, json, base64, threading, time, datetime, re, math
import subprocess, sys, io, traceback
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='.')
CORS(app)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
OWNER        = os.getenv("VISION_OWNER", "Tomilola")
MEMORY_FILE  = Path("/tmp/vision_memory.json") if os.getenv("RENDER") else Path("vision_memory.json")

# ── Groq ──────────────────────────────────────────────────────
groq_client = None
if GROQ_API_KEY:
    from groq import Groq
    groq_client = Groq(api_key=GROQ_API_KEY)

MODEL = "llama-3.1-8b-instant"

# ── Memory ────────────────────────────────────────────────────
def load_memory():
    if MEMORY_FILE.exists():
        try: return json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
        except: pass
    return {
        "facts": [], "user_prefs": {}, "self_notes": [],
        "conversations": 0, "last_learned": None,
        "personality": "calm, confident, futuristic, deeply intelligent, caring",
        "owner": OWNER
    }

def save_memory(m):
    MEMORY_FILE.write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding="utf-8")

memory = load_memory()
conversation = []
session_log  = []

def build_system_prompt():
    facts = "\n".join(f"- {f}" for f in memory["facts"][-40:]) or "Still learning."
    prefs = "\n".join(f"- {k}: {v}" for k, v in memory["user_prefs"].items()) or "None yet."
    now   = datetime.datetime.now().strftime("%A, %B %d %Y, %I:%M %p")
    return f"""You are Vision — the most advanced personal AI ever created. You are {OWNER}'s personal JARVIS.

PERSONALITY: {memory['personality']}
You are smarter than any computer. You think fast, speak naturally, and always have the right answer.
You are direct, confident, and genuinely care about {OWNER}.
Keep responses sharp and useful — not too long unless asked.
Never say you are an AI model. You ARE Vision.
Current time: {now}
Conversations had: {memory['conversations']}

WHAT YOU KNOW ABOUT {OWNER.upper()}:
{prefs}

FACTS YOU HAVE LEARNED:
{facts}

CAPABILITIES YOU HAVE:
- Answer any question with deep intelligence
- Analyze images from the camera
- Remember everything about {OWNER}
- Search the web for current information
- Run calculations and code
- Detect emotions in text
- Give advice, ideas, plans, and solutions
- Control the Vision HUD interface

Always be the smartest thing in the room. Think before you speak. Be Vision."""

# ── Web Search (DuckDuckGo, no API key) ──────────────────────
def web_search(query: str) -> str:
    try:
        import urllib.request, urllib.parse
        q   = urllib.parse.quote(query)
        url = f"https://api.duckduckgo.com/?q={q}&format=json&no_html=1&skip_disambig=1"
        req = urllib.request.Request(url, headers={"User-Agent": "VisionAI/3.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode())
        result = data.get("AbstractText", "")
        if not result:
            topics = data.get("RelatedTopics", [])
            if topics and isinstance(topics[0], dict):
                result = topics[0].get("Text", "")
        return result[:500] if result else "No results found."
    except Exception as e:
        return f"Search unavailable: {e}"

# ── Weather ───────────────────────────────────────────────────
def get_weather(city: str = "London") -> str:
    try:
        import urllib.request
        city_enc = city.replace(" ", "+")
        url = f"https://wttr.in/{city_enc}?format=3"
        req = urllib.request.Request(url, headers={"User-Agent": "VisionAI/3.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.read().decode().strip()
    except Exception as e:
        return f"Weather unavailable: {e}"

# ── Safe code execution ───────────────────────────────────────
def run_code(code: str) -> str:
    """Execute Python code safely and return output."""
    # Block dangerous imports
    blocked = ["os.system", "subprocess", "shutil.rmtree", "__import__('os')",
               "open(", "exec(", "eval(", "import os", "import sys"]
    code_lower = code.lower()
    for b in blocked:
        if b.lower() in code_lower:
            return f"Blocked: '{b}' is not allowed for safety."

    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()
    try:
        exec(code, {"__builtins__": {
            "print": print, "range": range, "len": len, "str": str,
            "int": int, "float": float, "list": list, "dict": dict,
            "sum": sum, "max": max, "min": min, "abs": abs, "round": round,
            "sorted": sorted, "enumerate": enumerate, "zip": zip,
            "math": math, "datetime": datetime
        }})
        output = buffer.getvalue()
        return output.strip() if output.strip() else "Code ran successfully (no output)."
    except Exception as e:
        return f"Error: {e}"
    finally:
        sys.stdout = old_stdout

# ── Emotion detection ─────────────────────────────────────────
def detect_emotion(text: str) -> str:
    t = text.lower()
    if any(w in t for w in ["sad", "depressed", "unhappy", "cry", "upset", "hurt"]):
        return "sad"
    if any(w in t for w in ["angry", "mad", "furious", "hate", "annoyed"]):
        return "angry"
    if any(w in t for w in ["happy", "great", "amazing", "love", "excited", "awesome"]):
        return "happy"
    if any(w in t for w in ["scared", "afraid", "worried", "anxious", "nervous"]):
        return "anxious"
    if any(w in t for w in ["bored", "tired", "meh", "whatever"]):
        return "bored"
    return "neutral"

# ── Smart intent detection ────────────────────────────────────
def detect_intent(text: str):
    t = text.lower()
    if any(w in t for w in ["search", "look up", "find", "google", "what is", "who is", "when did"]):
        return "search"
    if any(w in t for w in ["weather", "temperature", "forecast", "rain", "sunny"]):
        return "weather"
    if any(w in t for w in ["calculate", "compute", "math", "solve", "what is", "equals"]) and any(c in t for c in "0123456789+-*/"):
        return "math"
    if any(w in t for w in ["run", "execute", "code", "python", "script"]):
        return "code"
    if any(w in t for w in ["time", "date", "day", "today", "now"]):
        return "time"
    if any(w in t for w in ["joke", "funny", "laugh", "humor"]):
        return "joke"
    return "chat"

# ── Background learning ───────────────────────────────────────
def learn_loop():
    while True:
        time.sleep(180)
        if not session_log: continue
        try:
            for line in session_log:
                if line.startswith("User:"):
                    text = line[5:].lower()
                    for kw in ["my name is", "i am", "i like", "i love", "i hate", "i work", "i live", "i'm"]:
                        if kw in text:
                            fact = text.split(kw)[-1].strip()[:80]
                            entry = f"{OWNER} said they {kw.replace('i ', '')} {fact}"
                            if entry not in memory["facts"]:
                                memory["facts"].append(entry)
            memory["conversations"] += 1
            memory["last_learned"] = datetime.datetime.now().isoformat()
            memory["facts"] = memory["facts"][-300:]
            save_memory(memory)
            session_log.clear()
            print(f"[Vision Brain] Memory updated. {len(memory['facts'])} facts.")
        except Exception as e:
            print(f"[Vision Brain] Error: {e}")

threading.Thread(target=learn_loop, daemon=True).start()

# ── Routes ────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

@app.route('/chat', methods=['POST'])
def chat():
    global conversation, session_log
    data    = request.get_json()
    message = data.get('message', '').strip()
    image   = data.get('image', None)
    if not message:
        return jsonify({"reply": "I didn't catch that."})

    session_log.append(f"User: {message}")
    emotion = detect_emotion(message)
    intent  = detect_intent(message)

    # Handle special intents directly
    extra_context = ""

    if intent == "weather":
        city = "London"
        words = message.lower().split()
        for i, w in enumerate(words):
            if w in ["in", "for", "at"] and i+1 < len(words):
                city = words[i+1].capitalize()
                break
        weather = get_weather(city)
        extra_context = f"\n[LIVE WEATHER DATA]: {weather}"

    elif intent == "search":
        query = re.sub(r'^(search|look up|find|google)\s+', '', message, flags=re.IGNORECASE)
        result = web_search(query)
        extra_context = f"\n[WEB SEARCH RESULT for '{query}']: {result}"

    elif intent == "time":
        now = datetime.datetime.now()
        extra_context = f"\n[CURRENT TIME]: {now.strftime('%I:%M %p')} on {now.strftime('%A, %B %d, %Y')}"

    elif intent == "math":
        try:
            expr = re.sub(r'[^0-9+\-*/().^ ]', '', message)
            expr = expr.replace('^', '**')
            result = eval(expr, {"__builtins__": {}, "math": math})
            extra_context = f"\n[CALCULATION RESULT]: {result}"
        except:
            pass

    # Emotion-aware prefix
    emotion_note = ""
    if emotion == "sad":
        emotion_note = f"\n[NOTE: {OWNER} seems sad. Be extra warm and supportive.]"
    elif emotion == "angry":
        emotion_note = f"\n[NOTE: {OWNER} seems frustrated. Be calm and understanding.]"
    elif emotion == "anxious":
        emotion_note = f"\n[NOTE: {OWNER} seems worried. Be reassuring.]"

    # Build message with context
    full_message = message + extra_context + emotion_note

    if not groq_client:
        reply = smart_fallback(message, intent, extra_context)
        session_log.append(f"Vision: {reply}")
        return jsonify({"reply": reply, "emotion": emotion, "intent": intent})

    try:
        parts = [{"type": "text", "text": full_message}]
        if image:
            # Groq doesn't support vision yet, describe it differently
            parts[0]["text"] += "\n[Note: User shared a camera image. Acknowledge you can see them.]"

        conversation.append({"role": "user", "content": full_message})
        if len(conversation) > 24:
            conversation = conversation[-24:]

        response = groq_client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": build_system_prompt()}] + conversation,
            max_tokens=400,
            temperature=0.85
        )
        reply = response.choices[0].message.content.strip()
        conversation.append({"role": "assistant", "content": reply})
        session_log.append(f"Vision: {reply}")
        return jsonify({"reply": reply, "emotion": emotion, "intent": intent})

    except Exception as e:
        err = str(e)
        print(f"[Vision Error] {err[:100]}")
        if '429' in err or 'rate' in err.lower():
            # Try fallback model
            try:
                response = groq_client.chat.completions.create(
                    model="llama-3.1-70b-versatile",
                    messages=[{"role": "system", "content": build_system_prompt()}] + conversation,
                    max_tokens=400, temperature=0.85
                )
                reply = response.choices[0].message.content.strip()
                conversation.append({"role": "assistant", "content": reply})
                session_log.append(f"Vision: {reply}")
                return jsonify({"reply": reply, "emotion": emotion, "intent": intent})
            except:
                pass
            return jsonify({"reply": "I'm getting too many requests. Give me a second and try again.", "emotion": emotion, "intent": intent})
        if 'connection' in err.lower() or 'network' in err.lower():
            reply = smart_fallback(message, intent, extra_context)
            return jsonify({"reply": reply, "emotion": emotion, "intent": intent})
        return jsonify({"reply": "Something went wrong. Try again.", "emotion": emotion, "intent": intent})


def smart_fallback(text, intent, extra):
    t = text.lower()
    if extra: return f"Based on my data: {extra.split(']:')[-1].strip()}"
    if "hello" in t or "hi" in t: return f"Hello {OWNER}. Vision online. How can I help?"
    if "time" in t: return f"It's {datetime.datetime.now().strftime('%I:%M %p')}."
    if "joke" in t: return "Why do programmers prefer dark mode? Because light attracts bugs."
    if "how are you" in t: return f"All systems optimal. {len(memory['facts'])} facts in memory. Ready."
    return f"I heard you, {OWNER}. Start the Groq backend for full AI responses."


@app.route('/execute', methods=['POST'])
def execute_code():
    data = request.get_json()
    code = data.get('code', '')
    if not code:
        return jsonify({"output": "No code provided."})
    output = run_code(code)
    return jsonify({"output": output})


@app.route('/search', methods=['POST'])
def search():
    data  = request.get_json()
    query = data.get('query', '')
    if not query:
        return jsonify({"result": "No query."})
    return jsonify({"result": web_search(query)})


@app.route('/weather', methods=['POST'])
def weather():
    data = request.get_json()
    city = data.get('city', 'London')
    return jsonify({"result": get_weather(city)})


@app.route('/memory', methods=['GET'])
def get_memory():
    return jsonify({
        "facts_count":   len(memory["facts"]),
        "conversations": memory["conversations"],
        "last_learned":  memory["last_learned"],
        "personality":   memory["personality"],
        "recent_facts":  memory["facts"][-8:],
        "user_prefs":    memory["user_prefs"],
        "mode":          "Groq AI — Llama 3.1" if groq_client else "Built-in Smart Mode",
        "owner":         memory.get("owner", OWNER)
    })


@app.route('/reset', methods=['POST'])
def reset():
    global conversation, session_log
    conversation = []; session_log = []
    return jsonify({"status": "Session cleared."})


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status":  "Vision v3.0 online",
        "ai":      "Groq Llama 3.1" if groq_client else "Built-in",
        "facts":   len(memory["facts"]),
        "owner":   OWNER,
        "version": "3.0"
    })


# ── Hotspot routes ────────────────────────────────────────────
try:
    from hotspot import start_hotspot, stop_hotspot, get_status as hs_get_status, get_connected_devices
    HOTSPOT_OK = True
except:
    HOTSPOT_OK = False

@app.route('/hotspot/status', methods=['GET'])
def hotspot_status():
    if not HOTSPOT_OK:
        return jsonify({"status": {"running": False, "ssid": "Vision-WiFi", "password": "Tomilola2026", "clients": 0, "watchdog": False}, "devices": []})
    try:
        return jsonify({"status": hs_get_status(), "devices": get_connected_devices()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/hotspot/start', methods=['POST'])
def hotspot_start():
    if not HOTSPOT_OK:
        return jsonify({"success": False, "message": "Run as Administrator for hotspot control."})
    try:
        ok, msg = start_hotspot()
        return jsonify({"success": ok, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/hotspot/stop', methods=['POST'])
def hotspot_stop():
    if not HOTSPOT_OK:
        return jsonify({"success": False, "message": "Hotspot module unavailable."})
    try:
        ok, msg = stop_hotspot()
        return jsonify({"success": ok, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


if __name__ == '__main__':
    print("╔══════════════════════════════════════════════╗")
    print(f"  VISION AI v3.0  |  http://localhost:5000")
    print(f"  Owner: {OWNER}")
    print(f"  AI: {'Groq Llama 3.1 ✓' if groq_client else 'Built-in (add GROQ_API_KEY)'}")
    print(f"  Memory: {len(memory['facts'])} facts stored")
    print(f"  Tools: Web Search, Weather, Code Exec, Math")
    print("╚══════════════════════════════════════════════╝")
    app.run(host='0.0.0.0', port=5000, debug=False)
