import os
import sys
import time
import psutil
import frida
import json
import threading
from http.server import BaseHTTPRequestHandler
from socketserver import ThreadingTCPServer


SCRIPT_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CONFIG_DIR = os.path.join(SCRIPT_BASE_DIR, "patches", "alllready_configs")


MAP_CONFIGS = {
    "Expanse_Persistent": "Expanse.txt",
    "Departure_Persistent": "Departure.txt",
    "Approach_Persistent": "Approach.txt",
}


def resolve_script_path(script_path):
    return os.path.abspath(os.path.join(SCRIPT_BASE_DIR, script_path))


class TelemetryBridge:
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.latest_state = None
        self.last_update_ts = 0
        self.script = None
        self.lock = threading.Lock()

    def set_script(self, script):
        self.script = script

    def update_state(self, payload):
        with self.lock:
            self.latest_state = payload
            self.last_update_ts = time.time()

    def get_state(self):
        with self.lock:
            return self.latest_state, self.last_update_ts

    def send_command(self, payload):
        if not self.script:
            return False, "Telemetry script not loaded"
        try:
            self.script.post({"type": "command", "payload": payload})
            return True, None
        except Exception as exc:
            return False, str(exc)

    def make_handler(self):
        bridge = self

        class TelemetryHandler(BaseHTTPRequestHandler):
            def _send_json(self, status, payload):
                body = json.dumps(payload).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                if self.path == "/health":
                    self._send_json(200, {"ok": True})
                    return
                if self.path == "/state":
                    state, updated_at = bridge.get_state()
                    self._send_json(
                        200,
                        {
                            "ok": True,
                            "updatedAt": updated_at,
                            "state": state,
                        },
                    )
                    return
                self._send_json(404, {"ok": False, "error": "Not found"})

            def do_POST(self):
                if self.path != "/command":
                    self._send_json(404, {"ok": False, "error": "Not found"})
                    return
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length) if length > 0 else b""
                if not raw:
                    self._send_json(400, {"ok": False, "error": "Empty body"})
                    return
                try:
                    payload = json.loads(raw.decode("utf-8"))
                except json.JSONDecodeError:
                    self._send_json(400, {"ok": False, "error": "Invalid JSON"})
                    return
                ok, error = bridge.send_command(payload)
                if ok:
                    self._send_json(200, {"ok": True})
                else:
                    self._send_json(500, {"ok": False, "error": error})

            def log_message(self, format, *args):
                return

        return TelemetryHandler


telemetry_bridge = None


def on_message(msg, data):
    if msg.get("type") == "send":
        payload = msg.get("payload")
        if isinstance(payload, dict) and payload.get("type") == "telemetry":
            if telemetry_bridge:
                telemetry_bridge.update_state(payload.get("data"))
            return
    if msg.get("type") == "error":
        print("[frida:error]", msg)
        return
    print(msg)


def read_config(config_name):
    config_path = os.path.join(CONFIG_DIR, config_name)
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Config not found: {config_path}")
    with open(config_path, "r", encoding="utf-8") as file:
        data = file.read().strip()
    scripts = [line.strip() for line in data.splitlines() if line.strip() and not line.strip().startswith("#")]
    if not scripts:
        raise ValueError(f"No scripts configured in {config_path}")
    return scripts


def dedupe_scripts(scripts):
    seen = set()
    ordered = []
    for script in scripts:
        if script in seen:
            continue
        seen.add(script)
        ordered.append(script)
    return ordered


def load_scripts_config(map_value, mods_json=None, mods_list=None):
    if mods_list is not None:
        scripts = [item.strip() for item in mods_list if isinstance(item, str) and item.strip()]
        return dedupe_scripts(scripts)

    if mods_json is not None:
        if not mods_json.strip():
            return []
        try:
            data = json.loads(mods_json)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid mods JSON: {exc}") from exc
        if not isinstance(data, list):
            raise ValueError("mods JSON must be a list")
        scripts = [item.strip() for item in data if isinstance(item, str) and item.strip()]
        return dedupe_scripts(scripts)

    lowered = map_value.lower()
    base_config = MAP_CONFIGS.get(map_value)
    if not base_config:
        if "expanse" in lowered:
            base_config = MAP_CONFIGS.get("Expanse_Persistent")
        elif "departure" in lowered:
            base_config = MAP_CONFIGS.get("Departure_Persistent")
    if not base_config:
        raise ValueError(f"Unknown map value: {map_value!r}")

    scripts = read_config(base_config)
    if "solo" in lowered or "duo" in lowered:
        scripts += read_config("Solo_Duo.txt")

    return dedupe_scripts(scripts)


# Function to attach to the process and inject scripts
def attach_to_process_and_inject_scripts(session, scripts):
    loaded = []
    for script_path in scripts:
        resolved_path = resolve_script_path(script_path)
        if not os.path.exists(resolved_path):
            print(f"Warning: script not found, skipping: {resolved_path}")
            continue
        with open(resolved_path, 'r', encoding="utf-8") as file:
            script_code = file.read()
            script = inject_script(session, script_code)
            if script:
                loaded.append((script_path, script))
    return loaded

# Function to inject each script
def inject_script(session, script_code):
    try:
        script = session.create_script(script_code)
        script.on("message", on_message)
        script.load()  # Load and execute the script
        print("Successfully injected script.")
        return script
    except Exception as e:
        print(f"Error injecting script: {e}")
    return None

# Function to check if the process is still running by its PID
def is_process_running(pid):
    try:
        return psutil.pid_exists(pid)
    except psutil.NoSuchProcess:
        return False

# Automatically close the terminal after detaching
def close_terminal():
    os.system("taskkill /F /PID " + str(os.getpid()))  # Kill this script's process on Windows

def parse_pid_from_args(argv):
    """
    Usage: <PID> <MapValue> [Mode] [--mods-json <JSON>] [--mod <PATH>...] [--telemetry-port <PORT>] [--session-port <PORT>]
    """
    print("argv: ", argv)
    if len(argv) < 3:
        raise ValueError(
            f"Usage: {argv[0]} <PID> <MapValue> [Mode] [--mods-json <JSON>] [--mod <PATH>...] [--telemetry-port <PORT>] [--session-port <PORT>]"
        )
    pid_str = argv[1]
    map_str = argv[2]
    mode = ""
    mods_json = None
    mods_list = []
    telemetry_port = None
    session_port = None
    idx = 3
    while idx < len(argv):
        token = argv[idx]
        if token == "--mods-json":
            if idx + 1 >= len(argv):
                raise ValueError("Missing value for --mods-json")
            mods_json = argv[idx + 1]
            idx += 2
            continue
        if token == "--mod":
            if idx + 1 >= len(argv):
                raise ValueError("Missing value for --mod")
            mods_list.append(argv[idx + 1])
            idx += 2
            continue
        if token == "--telemetry-port":
            if idx + 1 >= len(argv):
                raise ValueError("Missing value for --telemetry-port")
            telemetry_port = int(argv[idx + 1])
            idx += 2
            continue
        if token == "--session-port":
            if idx + 1 >= len(argv):
                raise ValueError("Missing value for --session-port")
            session_port = int(argv[idx + 1])
            idx += 2
            continue
        if not mode:
            mode = token.lower()
            idx += 1
            continue
        raise ValueError(f"Unknown argument: {token}")
    if not pid_str.isdigit():
        raise ValueError(f"Invalid PID: {pid_str!r} (must be a positive integer)")
    pid = int(pid_str)
    if pid <= 0:
        raise ValueError(f"Invalid PID: {pid!r} (must be > 0)")
    return pid, map_str, mode, mods_json, mods_list, telemetry_port, session_port

# Main logic


if __name__ == "__main__":
    try:
        pid, map_str, mode, mods_json, mods_list, telemetry_port, session_port = parse_pid_from_args(sys.argv)
        print(f"PID: {pid}. Attaching Frida...")

        # Attach to the process using Frida
        session = frida.attach(pid)
        scripts = load_scripts_config(map_str, mods_json, mods_list if mods_list else None)
        if mods_json is None and not mods_list and mode == "test":
            scripts += read_config("Solo_Duo.txt")
            scripts = dedupe_scripts(scripts)
            
        print("Final scripts to inject:")
        if scripts:
            for script in scripts:
                print(f"  - {script}")
        else:
            print("  (no scripts)")

        loaded_scripts = attach_to_process_and_inject_scripts(session, scripts)

        telemetry_script = None
        for script_path, script in loaded_scripts:
            normalized = script_path.replace("\\", "/")
            if normalized.endswith("/telemetry/telemetry.js"):
                telemetry_script = script
                break

        server = None
        if telemetry_port:
            telemetry_bridge = TelemetryBridge("127.0.0.1", telemetry_port)
            if telemetry_script:
                telemetry_bridge.set_script(telemetry_script)
                try:
                    telemetry_script.post(
                        {
                            "type": "config",
                            "payload": {
                                "sessionPort": session_port or 0,
                                "telemetryPort": telemetry_port,
                            },
                        }
                    )
                except Exception as exc:
                    print(f"Failed to send telemetry config: {exc}")
            else:
                print("Telemetry port provided but telemetry script not loaded.")

            handler = telemetry_bridge.make_handler()
            server = ThreadingTCPServer((telemetry_bridge.host, telemetry_bridge.port), handler)
            server.daemon_threads = True
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            print(f"Telemetry HTTP server: http://{telemetry_bridge.host}:{telemetry_bridge.port}")
        
        # Frida finished
        print("Frida scripts have been injected.")
        
        # Monitor the process
        print("Monitoring active. Press Ctrl+C to exit.")
        while is_process_running(pid):
            time.sleep(1)  # Check every 1 second if the process is still running

        # Detach from Frida when the process stops running
        print(f"Process with PID {pid} has stopped. Detaching from Frida session.")
        session.detach()
        if server:
            try:
                server.shutdown()
            except Exception:
                pass

    except Exception as e:
        print(f"Error: {str(e)}")

    # Close the terminal automatically when finished
    close_terminal()