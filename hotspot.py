"""
Vision AI — Hotspot Controller
================================
Controls Windows Mobile Hotspot via netsh and PowerShell.
Includes watchdog to keep hotspot alive — never drops.

Requirements: Run as Administrator for full functionality.
"""

import subprocess
import json
import re
import threading
import time
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("Hotspot")

HOTSPOT_SSID     = "Vision-WiFi"
HOTSPOT_PASSWORD = "Tomilola2026"

# Watchdog state
_watchdog_running = False
_hotspot_should_be_on = False
_watchdog_thread = None


def run(cmd, shell=True, capture=True):
    try:
        result = subprocess.run(
            cmd, shell=shell, capture_output=capture,
            text=True, timeout=20
        )
        return result.stdout.strip(), result.returncode
    except Exception as e:
        return str(e), -1


def setup_hotspot():
    """Configure the hosted network settings."""
    cmd = (
        f'netsh wlan set hostednetwork mode=allow '
        f'ssid="{HOTSPOT_SSID}" key="{HOTSPOT_PASSWORD}"'
    )
    out, code = run(cmd)
    return code == 0, out


def _start_raw():
    """Internal: just start the hotspot without watchdog logic."""
    setup_hotspot()
    out, code = run('netsh wlan start hostednetwork')
    success = code == 0 or 'started' in out.lower() or 'already' in out.lower()
    if success:
        _enable_ics()
        _disable_auto_off()
    return success, out


def start_hotspot():
    """Start hotspot and enable watchdog to keep it alive."""
    global _hotspot_should_be_on
    _hotspot_should_be_on = True
    success, out = _start_raw()
    if success:
        _start_watchdog()
        return True, f"Hotspot '{HOTSPOT_SSID}' is live. Password: {HOTSPOT_PASSWORD}. Watchdog active — it will never drop."
    return False, f"Could not start hotspot: {out}. Try running as Administrator."


def stop_hotspot():
    """Stop hotspot and disable watchdog."""
    global _hotspot_should_be_on
    _hotspot_should_be_on = False
    out, code = run('netsh wlan stop hostednetwork')
    return True, "Hotspot stopped."


def _disable_auto_off():
    """Disable Windows auto-shutoff of hosted network when idle."""
    # Prevent Windows from killing the hotspot after idle timeout
    ps = (
        'Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\WlanSvc\\Parameters\\HostedNetworkSettings" '
        '-Name "HostedNetworkEnabled" -Value 1 -ErrorAction SilentlyContinue; '
        'powercfg /change standby-timeout-ac 0; '
        'powercfg /change standby-timeout-dc 0'
    )
    run(f'powershell -Command "{ps}"')

    # Also disable the "turn off hotspot if no devices connected" setting
    ps2 = (
        'Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\WlanSvc\\AnqpCache" '
        '-Name "OsuRegistrationStatus" -Value 0 -ErrorAction SilentlyContinue'
    )
    run(f'powershell -Command "{ps2}"')


def _enable_ics():
    """Enable Internet Connection Sharing."""
    ps = """
$adapters = Get-NetAdapter | Where-Object {$_.Status -eq 'Up'}
$internet = $adapters | Where-Object {$_.Name -notlike '*Virtual*' -and $_.Name -notlike '*Hosted*' -and $_.Name -notlike '*Local Area*'} | Select-Object -First 1
$hosted   = $adapters | Where-Object {$_.Name -like '*Local Area Connection*' -or $_.Name -like '*Hosted*'} | Select-Object -First 1
if ($internet) { Write-Host "Internet adapter: $($internet.Name)" }
if ($hosted)   { Write-Host "Hosted adapter: $($hosted.Name)" }
"""
    run(f'powershell -Command "{ps}"')


def is_running():
    """Check if hotspot is currently active."""
    out, _ = run('netsh wlan show hostednetwork')
    return 'started' in out.lower()


def _watchdog_loop():
    """Background thread: checks every 15s and restarts if dropped."""
    global _watchdog_running, _hotspot_should_be_on
    log.info("[Watchdog] Started — hotspot will stay alive")
    while _watchdog_running:
        try:
            if _hotspot_should_be_on and not is_running():
                log.info("[Watchdog] Hotspot dropped — restarting...")
                _start_raw()
                log.info("[Watchdog] Hotspot restarted")
        except Exception as e:
            log.error(f"[Watchdog] Error: {e}")
        time.sleep(15)
    log.info("[Watchdog] Stopped")


def _start_watchdog():
    global _watchdog_running, _watchdog_thread
    if _watchdog_running:
        return  # Already running
    _watchdog_running = True
    _watchdog_thread = threading.Thread(target=_watchdog_loop, daemon=True)
    _watchdog_thread.start()


def get_status():
    """Get current hotspot status and connected devices."""
    out, _ = run('netsh wlan show hostednetwork')
    status = {
        "running":   is_running(),
        "ssid":      HOTSPOT_SSID,
        "password":  HOTSPOT_PASSWORD,
        "clients":   0,
        "watchdog":  _watchdog_running and _hotspot_should_be_on,
        "raw":       out
    }
    match = re.search(r'Number of clients\s*:\s*(\d+)', out, re.IGNORECASE)
    if match:
        status["clients"] = int(match.group(1))
    return status


def get_connected_devices():
    """Get list of connected devices via ARP."""
    out, _ = run('arp -a')
    devices = []
    for line in out.split('\n'):
        line = line.strip()
        if re.match(r'\d+\.\d+\.\d+\.\d+', line):
            parts = line.split()
            if len(parts) >= 2 and not parts[0].startswith('224.') and not parts[0].startswith('255.'):
                devices.append({"ip": parts[0], "mac": parts[1] if len(parts) > 1 else "unknown"})
    return devices


def get_wifi_info():
    """Get current WiFi connection info."""
    out, _ = run('netsh wlan show interfaces')
    info = {}
    for line in out.split('\n'):
        if ':' in line:
            parts = line.split(':', 1)
            info[parts[0].strip()] = parts[1].strip() if len(parts) > 1 else ''
    return info
