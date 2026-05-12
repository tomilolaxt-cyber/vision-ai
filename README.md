# Vision - Personal AI Assistant

## Quick Start

### 1. Install Python dependencies
```
pip install -r requirements.txt
```

### 2. Your Gemini API key is already set in `.env`
Get keys at https://aistudio.google.com/app/apikey

### 3. Start the backend
```
python server.py
```

### 4. Open the website
Open `index.html` in Chrome (double-click it or drag into Chrome).

### 5. Talk to Vision
- Click the glowing circle to wake Vision
- Press **Speak** or hit **Spacebar** to talk
- Turn on **Camera** so Vision can see you

---

## Files
| File | Purpose |
|------|---------|
| `index.html` | The website UI |
| `style.css` | All the visuals / animations |
| `vision.js` | Browser logic (mic, camera, speech) |
| `server.py` | Python AI backend (GPT-4o) |
| `.env` | Your API key (keep this private) |
| `robot/vision_robot.cpp` | C++ code for the real-life robot |

## Robot (C++)
See `robot/vision_robot.cpp` for the physical robot version.
Compile on Raspberry Pi:
```
g++ -o vision_robot vision_robot.cpp -lwiringPi -lpthread
```
