#!/usr/bin/env python3
"""
VIZORIS — Mobile USB Image Transfer & Scanner Bridge
Transfers captured notebook images from Android mobile phone connected via USB/ADB
directly into the VIZORIS Vision Intelligence backend.

Usage:
  python usb_bridge.py [--poll-interval 2] [--api-url http://localhost:5000/api/scan/upload]
  python usb_bridge.py --simulate-capture scratch/test_case_ink_stain.jpg
"""

import sys
import time
import os
import argparse
import subprocess
import requests

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

DEFAULT_API_URL = "http://localhost:5000/api/scan/upload"
DEFAULT_STATUS_URL = "http://localhost:5000/api/scanner/status"
DEFAULT_HEARTBEAT_URL = "http://localhost:5000/api/scanner/heartbeat"

REMOTE_CAMERA_DIRS = [
    "/sdcard/DCIM/Camera",
    "/sdcard/DCIM/100ANDRO",
    "/sdcard/Pictures/Vizoris",
    "/storage/emulated/0/DCIM/Camera"
]

def find_adb():
    """Locate ADB executable in PATH or standard Android SDK directories."""
    try:
        res = subprocess.run(["adb", "version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0:
            return "adb"
    except FileNotFoundError:
        pass

    candidates = [
        os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"),
        os.path.expanduser(r"~\AppData\Local\Android\Sdk\platform-tools\adb.exe"),
        r"C:\platform-tools\adb.exe",
        r"C:\Program Files\Android\platform-tools\adb.exe",
        r"C:\Program Files (x86)\Android\android-sdk\platform-tools\adb.exe"
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None

def get_connected_devices(adb_bin):
    if not adb_bin:
        return []
    try:
        res = subprocess.run([adb_bin, "devices"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        lines = res.stdout.strip().split("\n")[1:]
        devices = [line.split()[0] for line in lines if "device" in line and not "offline" in line]
        return devices
    except Exception as e:
        print(f"[USB BRIDGE ERROR] Could not query ADB devices: {e}")
        return []

def set_scanner_status(api_url, status, device_name="No Scanner Connected", connection_type="USB 3.2 High-Speed Bridge"):
    status_url = api_url.replace("/scan/upload", "/scanner/status")
    try:
        requests.post(status_url, json={
            "status": status,
            "deviceName": device_name,
            "connectionType": connection_type
        }, timeout=2)
    except Exception:
        pass

def send_heartbeat(api_url, device_name="Mobile Phone (USB ADB)"):
    heartbeat_url = api_url.replace("/scan/upload", "/scanner/heartbeat")
    try:
        requests.post(heartbeat_url, json={
            "status": "CONNECTED",
            "deviceName": device_name
        }, timeout=2)
    except Exception:
        pass

def upload_image(file_path, api_url, device_name="Android Mobile via USB"):
    print(f"\n[USB BRIDGE] [TRANSFER] Uploading new notebook scan to VIZORIS: {file_path}")
    set_scanner_status(api_url, "TRANSFERRING", device_name)
    try:
        with open(file_path, "rb") as f:
            files = {"image": (os.path.basename(file_path), f, "image/jpeg")}
            data = {"scannerSource": "MOBILE_PHONE_USB", "transferredAt": time.time()}
            resp = requests.post(api_url, files=files, data=data, timeout=15)
            if resp.status_code in [200, 202]:
                print(f"[USB BRIDGE] [OK] Transferred successfully! Server response: {resp.json().get('message')}")
                set_scanner_status(api_url, "CONNECTED", device_name)
                return True
            else:
                print(f"[USB BRIDGE] [WARN] Server returned status {resp.status_code}: {resp.text}")
                set_scanner_status(api_url, "ERROR", device_name)
                return False
    except Exception as e:
        print(f"[USB BRIDGE] [ERROR] Upload failed: {e}")
        set_scanner_status(api_url, "ERROR", device_name)
        return False

def monitor_adb(adb_bin, device_id, api_url, poll_interval=2):
    device_name = f"Android Mobile ({device_id}) via USB"
    print(f"[USB BRIDGE] Monitoring device {device_id} for new notebook photos...")
    set_scanner_status(api_url, "CONNECTED", device_name)
    
    known_files = set()
    active_remote_dir = None

    for remote_dir in REMOTE_CAMERA_DIRS:
        res = subprocess.run([adb_bin, "-s", device_id, "shell", f"ls -t {remote_dir}"],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0 and res.stdout.strip():
            active_remote_dir = remote_dir
            for f in res.stdout.split():
                if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                    known_files.add(f.strip())
            print(f"[USB BRIDGE] Found active photo folder: {active_remote_dir} ({len(known_files)} initial files)")
            break

    if not active_remote_dir:
        active_remote_dir = "/sdcard/DCIM/Camera"
        print(f"[USB BRIDGE] Defaulting to {active_remote_dir}")

    tmp_dir = os.path.join(os.path.dirname(__file__), "scratch", "usb_incoming")
    os.makedirs(tmp_dir, exist_ok=True)

    heartbeat_counter = 0
    try:
        while True:
            time.sleep(poll_interval)
            heartbeat_counter += 1
            if heartbeat_counter >= 5:
                send_heartbeat(api_url, device_name)
                heartbeat_counter = 0

            # Verify device is still connected
            current_devices = get_connected_devices(adb_bin)
            if device_id not in current_devices:
                print(f"[USB BRIDGE] [WARN] Device {device_id} disconnected!")
                set_scanner_status(api_url, "DISCONNECTED", "Scanner Disconnected")
                break

            # Query newest files
            res = subprocess.run([adb_bin, "-s", device_id, "shell", f"ls -t {active_remote_dir}"],
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.returncode != 0:
                continue

            current_files = [f.strip() for f in res.stdout.split() if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]
            for f in current_files:
                if f not in known_files:
                    print(f"\n[USB BRIDGE] [NEW PHOTO] New photo detected on phone: {f}")
                    local_target = os.path.join(tmp_dir, f)
                    remote_file = f"{active_remote_dir}/{f}"
                    # Pull via ADB
                    pull_res = subprocess.run([adb_bin, "-s", device_id, "pull", remote_file, local_target],
                                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    if pull_res.returncode == 0 and os.path.exists(local_target):
                        upload_image(local_target, api_url, device_name)
                    known_files.add(f)

    except KeyboardInterrupt:
        print("\n[USB BRIDGE] Bridge stopped by user.")
        set_scanner_status(api_url, "DISCONNECTED", "No Scanner Connected")

def main():
    parser = argparse.ArgumentParser(description="VIZORIS Mobile USB Scanner Bridge")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="VIZORIS API upload endpoint")
    parser.add_argument("--poll-interval", type=int, default=2, help="Seconds between camera folder polls")
    parser.add_argument("--simulate-capture", help="Simulate a captured notebook photo transfer over USB")
    args = parser.parse_args()

    print("=" * 60)
    print(" VIZORIS - Mobile USB Image Transfer & Scanner Bridge")
    print(" Vision Intelligence for Zero-Defect Manufacturing")
    print("=" * 60)

    # Simulation mode
    if args.simulate_capture:
        sim_path = os.path.abspath(args.simulate_capture)
        if not os.path.exists(sim_path):
            print(f"[USB BRIDGE ERROR] Simulation image not found: {sim_path}")
            sys.exit(1)
        sim_device = "Mobile Scanner (Simulated USB Link)"
        print(f"[USB BRIDGE] Simulating USB device connection: {sim_device}")
        set_scanner_status(args.api_url, "CONNECTED", sim_device)
        time.sleep(1)
        print(f"[USB BRIDGE] Transferring scan over USB bridge: {sim_path}")
        success = upload_image(sim_path, args.api_url, sim_device)
        if success:
            print("[USB BRIDGE] Simulation transfer complete!")
        else:
            print("[USB BRIDGE] Simulation transfer failed.")
        return

    adb_bin = find_adb()
    if not adb_bin:
        print("[USB BRIDGE WARNING] 'adb' command not found in PATH or standard SDK paths.")
        print("For physical Android USB capture:")
        print("  1. Enable 'USB Debugging' in Android Developer Options.")
        print("  2. Install Android Platform Tools (adb) or use Chrome WebADB.")
        print("  3. Alternatively, test using: python usb_bridge.py --simulate-capture <path>")
        print("-" * 60)
        set_scanner_status(args.api_url, "DISCONNECTED", "No USB device attached")
        return

    print(f"[USB BRIDGE] Found ADB executable: {adb_bin}")
    devices = get_connected_devices(adb_bin)
    if not devices:
        print("[USB BRIDGE] No physical USB ADB devices detected right now.")
        print("[USB BRIDGE] Standing by for device connection...")
        set_scanner_status(args.api_url, "DISCONNECTED", "No USB device attached")
        while not devices:
            time.sleep(3)
            devices = get_connected_devices(adb_bin)

    print(f"[USB BRIDGE] Target Device Connected: {devices[0]}")
    monitor_adb(adb_bin, devices[0], args.api_url, args.poll_interval)

if __name__ == "__main__":
    main()

