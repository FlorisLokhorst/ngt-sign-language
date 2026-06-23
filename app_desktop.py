"""
SignSee NGT — Desktop Application
Launches backend server + opens native window
"""
import sys
import threading
import time
from pathlib import Path
import webview
import uvicorn

if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).parent

sys.path.insert(0, str(BASE_DIR))
from app import app

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8000
SERVER_URL = f"http://{SERVER_HOST}:{SERVER_PORT}"


def start_server():
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT, log_level="error", access_log=False)


def wait_for_server(timeout=30):
    import socket
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex((SERVER_HOST, SERVER_PORT))
            sock.close()
            if result == 0:
                print("[OK] Server is ready!")
                return True
        except Exception:
            pass
        time.sleep(0.5)
    print("[ERROR] Server failed to start")
    return False


def main():
    print("=" * 60)
    print(" SignSee NGT — Dutch Sign Language Recognition")
    print("=" * 60)

    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    if not wait_for_server():
        input("Press Enter to exit...")
        sys.exit(1)

    window = webview.create_window(
        title="SignSee NGT",
        url=SERVER_URL,
        width=1400,
        height=900,
        resizable=True,
        min_size=(800, 600),
    )
    webview.start(debug=False)
    print("[INFO] Application closed")


if __name__ == "__main__":
    main()
