"""
Vision AI — LG TV Controller
==============================
Controls LG webOS TV via the local network API.
TV IP: 192.168.1.11
"""

import json
import ssl
import time
import threading
import urllib.request
import urllib.error

TV_IP   = "192.168.1.11"
TV_PORT = 3000   # LG webOS uses port 3000 (ws) or 3001 (wss)

# ── Simple HTTP commands via LG REST API ──────────────────────
def tv_request(path, method="GET", data=None):
    url = f"http://{TV_IP}:{TV_PORT}{path}"
    try:
        body = json.dumps(data).encode() if data else None
        req  = urllib.request.Request(url, data=body, method=method,
               headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode()), True
    except Exception as e:
        return {"error": str(e)}, False


def get_tv_status():
    """Check if TV is reachable."""
    try:
        urllib.request.urlopen(f"http://{TV_IP}:{TV_PORT}", timeout=3)
        return True
    except:
        return False


# ── WebSocket control (LG webOS uses WebSocket) ───────────────
try:
    import websocket
    WS_AVAILABLE = True
except ImportError:
    WS_AVAILABLE = False

TV_CLIENT_KEY = None   # Stored after first pairing

def send_ws_command(uri, payload):
    """Send a command via WebSocket to LG TV."""
    if not WS_AVAILABLE:
        return {"error": "websocket-client not installed. Run: pip install websocket-client"}

    results = {}
    done    = threading.Event()

    def on_open(ws):
        # Register/pair first
        register_msg = json.dumps({
            "type": "register",
            "id":   "register_0",
            "payload": {
                "forcePairing": False,
                "pairingType":  "PROMPT",
                "manifest": {
                    "manifestVersion": 1,
                    "appVersion":      "1.1",
                    "signed": {
                        "created":    "20140509",
                        "appId":      "com.lge.test",
                        "vendorId":   "com.lge",
                        "localizedAppNames": {"": "Vision AI"},
                        "localizedVendorNames": {"": "Vision"},
                        "permissions": ["TEST_SECURE","CONTROL_INPUT_TEXT","CONTROL_MOUSE_AND_KEYBOARD","READ_INSTALLED_APPS","READ_LGE_SDX","READ_NOTIFICATIONS","SEARCH","WRITE_SETTINGS","WRITE_NOTIFICATION_ALERT","CONTROL_POWER","READ_CURRENT_CHANNEL","READ_RUNNING_APPS","READ_UPDATE_INFO","UPDATE_FROM_REMOTE_APP","READ_LGE_TV_INPUT_EVENTS","READ_TV_CURRENT_TIME"]
                    }
                },
                **({"client-key": TV_CLIENT_KEY} if TV_CLIENT_KEY else {})
            }
        })
        ws.send(register_msg)

    def on_message(ws, message):
        global TV_CLIENT_KEY
        msg = json.loads(message)
        if msg.get("type") == "registered":
            TV_CLIENT_KEY = msg.get("payload", {}).get("client-key", TV_CLIENT_KEY)
            # Now send the actual command
            ws.send(json.dumps({"type": "request", "id": "cmd_1", "uri": uri, "payload": payload or {}}))
        elif msg.get("id") == "cmd_1":
            results["response"] = msg
            ws.close()
            done.set()

    def on_error(ws, error):
        results["error"] = str(error)
        done.set()

    def on_close(ws, *args):
        done.set()

    ws_app = websocket.WebSocketApp(
        f"ws://{TV_IP}:{TV_PORT}",
        on_open=on_open, on_message=on_message,
        on_error=on_error, on_close=on_close,
        header={"Origin": "null"}
    )
    t = threading.Thread(target=ws_app.run_forever)
    t.daemon = True
    t.start()
    done.wait(timeout=8)
    return results.get("response", results.get("error", "Timeout"))


# ── TV Commands ───────────────────────────────────────────────
def tv_volume_up():
    return send_ws_command("ssap://audio/volumeUp", {})

def tv_volume_down():
    return send_ws_command("ssap://audio/volumeDown", {})

def tv_set_volume(level):
    return send_ws_command("ssap://audio/setVolume", {"volume": int(level)})

def tv_mute(muted=True):
    return send_ws_command("ssap://audio/setMute", {"mute": muted})

def tv_turn_off():
    return send_ws_command("ssap://system/turnOff", {})

def tv_get_volume():
    return send_ws_command("ssap://audio/getVolume", {})

def tv_launch_app(app_id):
    return send_ws_command("ssap://system.launcher/launch", {"id": app_id})

def tv_launch_youtube():
    return tv_launch_app("youtube.leanback.v4")

def tv_launch_netflix():
    return tv_launch_app("netflix")

def tv_launch_browser():
    return tv_launch_app("com.webos.app.browser")

def tv_open_url(url):
    return send_ws_command("ssap://system.launcher/open", {"target": url})

def tv_get_apps():
    return send_ws_command("ssap://com.webos.applicationManager/listApps", {})

def tv_get_current_app():
    return send_ws_command("ssap://com.webos.applicationManager/getForegroundAppInfo", {})

def tv_send_enter():
    return send_ws_command("ssap://com.webos.service.ime/sendEnterKey", {})

def tv_show_toast(message):
    return send_ws_command("ssap://system.notifications/createToast", {"message": message})

def tv_channel_up():
    return send_ws_command("ssap://tv/channelUp", {})

def tv_channel_down():
    return send_ws_command("ssap://tv/channelDown", {})

def tv_get_channels():
    return send_ws_command("ssap://tv/getChannelList", {})

def tv_play():
    return send_ws_command("ssap://media.controls/play", {})

def tv_pause():
    return send_ws_command("ssap://media.controls/pause", {})

def tv_stop():
    return send_ws_command("ssap://media.controls/stop", {})
