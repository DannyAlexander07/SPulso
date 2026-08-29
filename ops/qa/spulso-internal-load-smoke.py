#!/usr/bin/env python3
import concurrent.futures
import json
import os
import threading
import time
import urllib.error
import urllib.request

BASE_URL = os.environ.get("SPULSO_LOAD_BASE_URL", "http://127.0.0.1:3101").rstrip("/")
CREDENTIAL_FILE = os.environ.get(
    "SPULSO_CREDENTIAL_FILE", "/opt/spulso/staging-credentials.txt"
)
VIRTUAL_USERS = int(os.environ.get("SPULSO_LOAD_VUS", "10"))
DURATION_SECONDS = int(os.environ.get("SPULSO_LOAD_DURATION_SECONDS", "60"))
THINK_TIME_SECONDS = float(os.environ.get("SPULSO_LOAD_THINK_TIME_SECONDS", "1"))

if not 1 <= VIRTUAL_USERS <= 100:
    raise SystemExit("SPULSO_LOAD_VUS debe estar entre 1 y 100")
if not 5 <= DURATION_SECONDS <= 600:
    raise SystemExit("SPULSO_LOAD_DURATION_SECONDS debe estar entre 5 y 600")


def credentials():
    values = {}
    with open(CREDENTIAL_FILE, encoding="utf-8") as credential_file:
        for line in credential_file:
            key, separator, value = line.rstrip("\n").partition("=")
            if separator:
                values[key] = value
    return values


def request(path, token=None, method="GET", body=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        headers["Content-Type"] = "application/json"
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(
            urllib.request.Request(
                BASE_URL + path,
                data=body,
                headers=headers,
                method=method,
            ),
            timeout=10,
        ) as response:
            response.read()
            return response.status, (time.perf_counter() - started) * 1000
    except urllib.error.HTTPError as error:
        error.read()
        return error.code, (time.perf_counter() - started) * 1000
    except Exception:
        return 0, (time.perf_counter() - started) * 1000


secrets = credentials()
login_body = json.dumps(
    {"email": secrets["ADMIN_EMAIL"], "password": secrets["ADMIN_PASSWORD"]}
).encode()
with urllib.request.urlopen(
    urllib.request.Request(
        BASE_URL + "/auth/login",
        data=login_body,
        headers={"Content-Type": "application/json"},
        method="POST",
    ),
    timeout=15,
) as login_response:
    token = json.load(login_response)["accessToken"]

paths = [
    "/health",
    "/trabajadores?pageSize=20&pagination=cursor",
    "/organizacion",
    "/asistencia/resumen",
    "/notificaciones",
]
deadline = time.monotonic() + DURATION_SECONDS
results = []
results_lock = threading.Lock()


def worker(worker_number):
    request_index = worker_number
    local_results = []
    while time.monotonic() < deadline:
        local_results.append(request(paths[request_index % len(paths)], token))
        request_index += 1
        time.sleep(THINK_TIME_SECONDS)
    with results_lock:
        results.extend(local_results)


with concurrent.futures.ThreadPoolExecutor(max_workers=VIRTUAL_USERS) as executor:
    list(executor.map(worker, range(VIRTUAL_USERS)))

durations = sorted(duration for _, duration in results)
failed = [status for status, _ in results if not 200 <= status < 300]
status_counts = {}
for status, _ in results:
    status_counts[str(status)] = status_counts.get(str(status), 0) + 1


def percentile(quantile):
    if not durations:
        return 0
    index = min(len(durations) - 1, int(len(durations) * quantile))
    return round(durations[index])


summary = {
    "requests": len(results),
    "failed": len(failed),
    "errorRate": len(failed) / len(results) if results else 1,
    "durationSeconds": DURATION_SECONDS,
    "virtualUsers": VIRTUAL_USERS,
    "requestsPerSecond": len(results) / DURATION_SECONDS,
    "p50Ms": percentile(0.5),
    "p95Ms": percentile(0.95),
    "p99Ms": percentile(0.99),
    "statusCounts": status_counts,
}
print(json.dumps(summary, indent=2))
if summary["errorRate"] > 0.01 or summary["p95Ms"] > 1500:
    raise SystemExit(2)
