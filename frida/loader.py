import os
import sys
import time
import psutil
import frida


SCRIPT_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CONFIG_DIR = os.path.join(SCRIPT_BASE_DIR, "patches", "alllready_configs")


MAP_CONFIGS = {
    "Expanse_Persistent": "Expanse.txt",
    "Departure_Persistent": "Departure.txt",
    "Approach_Persistent": "Approach.txt",
}


def resolve_script_path(script_path):
    return os.path.abspath(os.path.join(SCRIPT_BASE_DIR, script_path))


def on_message(msg, data):
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


def load_scripts_config(map_value):
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
    for script_path in scripts:
        resolved_path = resolve_script_path(script_path)
        if not os.path.exists(resolved_path):
            print(f"Warning: script not found, skipping: {resolved_path}")
            continue
        with open(resolved_path, 'r', encoding="utf-8") as file:
            script_code = file.read()
            inject_script(session, script_code)

# Function to inject each script
def inject_script(session, script_code):
    try:
        script = session.create_script(script_code)
        script.on("message", on_message)
        script.load()  # Load and execute the script
        print("Successfully injected script.")
    except Exception as e:
        print(f"Error injecting script: {e}")

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
    Expect exactly one argument (the PID).
    """
    print("argv: ", argv)
    if len(argv) not in (3, 4):
        raise ValueError(f"Usage: {argv[0]} <PID> <MapValue> [Mode]")
    pid_str = argv[1]
    map_str = argv[2]
    mode = argv[3].lower() if len(argv) == 4 else ""
    if not pid_str.isdigit():
        raise ValueError(f"Invalid PID: {pid_str!r} (must be a positive integer)")
    pid = int(pid_str)
    if pid <= 0:
        raise ValueError(f"Invalid PID: {pid!r} (must be > 0)")
    return pid, map_str, mode

# Main logic


if __name__ == "__main__":
    try:
        
        pid, map_str, mode = parse_pid_from_args(sys.argv)
        print(f"PID: {pid}. Attaching Frida...")

        # Attach to the process using Frida
        session = frida.attach(pid)
        scripts = load_scripts_config(map_str)
        if mode == "test":
            scripts += read_config("Solo_Duo.txt")
            scripts = dedupe_scripts(scripts)
            
        print("Final scripts to inject:")
        for script in scripts:
            print(f"  - {script}")

        attach_to_process_and_inject_scripts(session, scripts)
        
        # Frida finished
        print("Frida scripts have been injected.")
        
        # Monitor the process
        print("Monitoring active. Press Ctrl+C to exit.")
        while is_process_running(pid):
            time.sleep(1)  # Check every 1 second if the process is still running

        # Detach from Frida when the process stops running
        print(f"Process with PID {pid} has stopped. Detaching from Frida session.")
        session.detach()

    except Exception as e:
        print(f"Error: {str(e)}")

    # Close the terminal automatically when finished
    close_terminal()