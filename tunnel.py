#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SET ARENA // 1V1 AIR HOCKEY - YÜKSEK HIZLI CANLI İNTERNET TÜNELİ (ngrok / Cloudflare)
Hücresel veri (4G/5G) üzerinden minimum gecikme (15-20ms) ile anında 1v1 maç sağlar.
"""

import os
import sys
import time
import re
import socket
import subprocess
import json
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BIN_PATH = os.path.join(BASE_DIR, 'bin', 'cloudflared')
LOG_FILE = os.path.join(BASE_DIR, 'tunnel.log')
TUNNEL_FILE = os.path.join(BASE_DIR, 'tunnel_url.txt')
PORT = 3000

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def copy_to_clipboard(text):
    try:
        p = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE)
        p.communicate(text.encode('utf-8'))
    except Exception:
        pass

def notify_macos(title, message):
    try:
        cmd = f'display notification "{message}" with title "{title}" sound name "Glass"'
        subprocess.run(['osascript', '-e', cmd], capture_output=True, timeout=2)
    except Exception:
        pass

def check_local_server():
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=2)
        return True
    except Exception:
        return False

def ensure_local_server():
    if not check_local_server():
        print(f"⚡ Oyun sunucusu (Port {PORT}) başlatılıyor...")
        subprocess.Popen(['node', 'server.js'], cwd=BASE_DIR,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.5)

def check_ngrok_existing():
    try:
        req = urllib.request.Request("http://127.0.0.1:4040/api/tunnels", headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req, timeout=1.5)
        data = json.loads(res.read().decode('utf-8'))
        tunnels = data.get('tunnels', [])
        for t in tunnels:
            if t.get('proto') == 'https' and t.get('public_url'):
                return t['public_url']
    except Exception:
        pass
    return None

def start_ngrok_tunnel():
    existing = check_ngrok_existing()
    if existing:
        return None, existing

    ngrok_bin = '/opt/homebrew/bin/ngrok'
    if not os.path.exists(ngrok_bin):
        ngrok_bin = 'ngrok'

    try:
        proc = subprocess.Popen([ngrok_bin, 'http', str(PORT)],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        start_t = time.time()
        while time.time() - start_t < 10:
            time.sleep(0.5)
            url = check_ngrok_existing()
            if url:
                return proc, url
        proc.terminate()
    except Exception:
        pass
    return None, None

def start_cloudflared_tunnel():
    if not os.path.exists(BIN_PATH):
        return None, None
    os.chmod(BIN_PATH, 0o755)

    if os.path.exists(LOG_FILE):
        try: os.remove(LOG_FILE)
        except Exception: pass

    cmd = [BIN_PATH, 'tunnel', '--url', f'http://127.0.0.1:{PORT}']
    log_fp = open(LOG_FILE, 'w', encoding='utf-8', errors='ignore')
    proc = subprocess.Popen(cmd, stdout=log_fp, stderr=log_fp)

    pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
    public_url = None
    start_t = time.time()

    while time.time() - start_t < 25:
        if os.path.exists(LOG_FILE):
            try:
                with open(LOG_FILE, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                m = pattern.search(content)
                if m:
                    public_url = m.group(0)
                    break
            except Exception:
                pass
        time.sleep(0.5)

    if not public_url:
        proc.terminate()
        return None, None

    return proc, public_url

def main():
    print("=" * 68)
    print("⚡ SET ARENA // 1V1 AIR HOCKEY - YÜKSEK HIZLI CANLI TÜNEL")
    print("=" * 68)

    ensure_local_server()
    local_ip = get_local_ip()

    print("\n⏳ Yüksek hızlı tünel (ngrok / ultra-düşük gecikme) kontrol ediliyor...")
    proc, public_url = start_ngrok_tunnel()

    if not public_url:
        print("⏳ ngrok bulunamadı, Cloudflare Edge tüneli başlatılıyor...")
        proc, public_url = start_cloudflared_tunnel()

    if not public_url:
        print("❌ Tünel başlatılamadı. Lütfen internet bağlantınızı kontrol edin.")
        sys.exit(1)

    try:
        with open(TUNNEL_FILE, 'w', encoding='utf-8') as f:
            f.write(public_url)
    except Exception:
        pass

    copy_to_clipboard(public_url)
    notify_macos("SET Arena Yüksek Hızda!", f"Canlı Link:\n{public_url}")

    print("=" * 68)
    print("🎉 OYUN SÜPER HIZLI İNTERNETTE YAYINDA!")
    print(f"👉 Yüksek Hızlı Link (4G/5G): {public_url}")
    print(f"👉 Yerel Ağ (Aynı Wi-Fi):    http://{local_ip}:{PORT}")
    print(f"👉 Localhost (Bu Cihaz):     http://localhost:{PORT}")
    print("📋 (Link panonuza kopyalandı! QR kod bu link ile otomatik oluşur)")
    print("=" * 68)
    print("Tünel aktif. Stant boyunca açık bırakabilirsiniz...\n")

    while True:
        time.sleep(15)
        # Keep alive check
        active_url = check_ngrok_existing()
        if not active_url and proc and proc.poll() is not None:
            print("⚡ Yeniden bağlanıyor...")
            proc, public_url = start_ngrok_tunnel()
            if not public_url:
                proc, public_url = start_cloudflared_tunnel()
            if public_url:
                try:
                    with open(TUNNEL_FILE, 'w', encoding='utf-8') as f:
                        f.write(public_url)
                except Exception: pass

if __name__ == '__main__':
    main()
