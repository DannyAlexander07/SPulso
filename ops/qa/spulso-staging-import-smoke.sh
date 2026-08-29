#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${SPULSO_APP_DIR:-/opt/spulso/app}"
ENV_FILE="${SPULSO_ENV_FILE:-${APP_DIR}/.env.production}"
CREDENTIAL_FILE="${SPULSO_CREDENTIAL_FILE:-/opt/spulso/staging-credentials.txt}"
COMPOSE_FILE="${APP_DIR}/docker-compose.production.yml"
QA_FILE="/tmp/spulso-qa-import-$$.xlsx"

cleanup() {
  rm -f "${QA_FILE}"
}
trap cleanup EXIT

read_credential() {
  sed -n "s/^${1}=//p" "${CREDENTIAL_FILE}" | head -1
}

ADMIN_EMAIL="$(read_credential ADMIN_EMAIL)"
ADMIN_PASSWORD="$(read_credential ADMIN_PASSWORD)"
test -n "${ADMIN_EMAIL}"
test -n "${ADMIN_PASSWORD}"

compose=(docker compose --project-directory "${APP_DIR}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
COMPANY_ID="$(
  printf '%s\n' "SELECT id FROM \"Company\" WHERE slug = 'grupo-sp' LIMIT 1;" \
    | "${compose[@]}" exec -T postgres sh -c \
      'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' \
    | tr -d '\r'
)"
AREA_NAME="$(
  printf '%s\n' "SELECT name FROM \"Area\" WHERE \"companyId\" = '${COMPANY_ID}' AND status = 'ACTIVE' ORDER BY name LIMIT 1;" \
    | "${compose[@]}" exec -T postgres sh -c \
      'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' \
    | tr -d '\r'
)"
POSITION_NAME="$(
  printf '%s\n' "SELECT name FROM \"JobPosition\" WHERE status = 'ACTIVE' AND (\"companyId\" = '${COMPANY_ID}' OR scope = 'GROUP') ORDER BY name LIMIT 1;" \
    | "${compose[@]}" exec -T postgres sh -c \
      'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' \
    | tr -d '\r'
)"
test -n "${COMPANY_ID}"
test -n "${AREA_NAME}"
test -n "${POSITION_NAME}"

STAMP="$(date -u +%y%m%d%H%M%S)"
DOC_ONE="QA${STAMP}A"
DOC_TWO="QA${STAMP}B"
API_CONTAINER="$("${compose[@]}" ps -q api)"

docker exec -i \
  -e QA_AREA="${AREA_NAME}" \
  -e QA_POSITION="${POSITION_NAME}" \
  -e QA_DOC_ONE="${DOC_ONE}" \
  -e QA_DOC_TWO="${DOC_TWO}" \
  "${API_CONTAINER}" node <<'NODE'
const { Workbook } = require('exceljs');
(async () => {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Trabajadores');
  sheet.addRow([
    'Nombres', 'Apellidos', 'DNI', 'Correo personal', 'Celular', 'Dirección',
    'Área', 'Cargo', 'Equipo', 'Jefe DNI o código', 'Fecha ingreso',
    'Código trabajador', 'PIN marcación',
  ]);
  sheet.addRow([
    'QA Excel', 'Valido', process.env.QA_DOC_ONE, '', '999111222', 'Lima',
    process.env.QA_AREA, process.env.QA_POSITION, '', '', '2026-08-29', '', '749285',
  ]);
  sheet.addRow([
    'QA Excel', '', process.env.QA_DOC_TWO, '', '', '', process.env.QA_AREA,
    process.env.QA_POSITION, '', '', '2026-08-29', '', '638251',
  ]);
  await workbook.xlsx.writeFile('/tmp/spulso-qa-import.xlsx');
})();
NODE
docker cp "${API_CONTAINER}:/tmp/spulso-qa-import.xlsx" "${QA_FILE}" >/dev/null

export ADMIN_EMAIL ADMIN_PASSWORD COMPANY_ID DOC_ONE DOC_TWO QA_FILE
python3 <<'PY'
import json
import os
import urllib.request
import uuid

BASE_URL = 'http://127.0.0.1:3101'

def request_json(path, *, data=None, headers=None, method=None):
    request = urllib.request.Request(
        BASE_URL + path,
        data=data,
        headers=headers or {},
        method=method,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

login = json.dumps({
    'email': os.environ['ADMIN_EMAIL'],
    'password': os.environ['ADMIN_PASSWORD'],
}).encode()
token = request_json(
    '/auth/login',
    data=login,
    headers={'Content-Type': 'application/json'},
)['accessToken']
authorization = {'Authorization': f'Bearer {token}'}

def upload():
    boundary = '----SPulsoQA' + uuid.uuid4().hex
    file_bytes = open(os.environ['QA_FILE'], 'rb').read()
    parts = []
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="companyId"\r\n\r\n'
        f'{os.environ["COMPANY_ID"]}\r\n'.encode()
    )
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
        'filename="qa-import.xlsx"\r\nContent-Type: '
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'.encode()
        + file_bytes
        + b'\r\n'
    )
    parts.append(f'--{boundary}--\r\n'.encode())
    return request_json(
        '/trabajadores/importaciones',
        data=b''.join(parts),
        headers={
            **authorization,
            'Content-Type': f'multipart/form-data; boundary={boundary}',
        },
    )

batch = upload()
assert batch['importedRows'] == 1, batch
assert batch['pendingRows'] == 1, batch
pending = next(row for row in batch['rows'] if row['status'] == 'PENDING')
correction = json.dumps({
    'attendancePin': '638251',
    'data': {'lastName': 'Corregido VPS'},
    'version': pending['version'],
}).encode()
completed = request_json(
    f'/trabajadores/importaciones/{batch["id"]}/filas/{pending["id"]}',
    data=correction,
    headers={**authorization, 'Content-Type': 'application/json'},
    method='PATCH',
)
assert completed['importedRows'] == 2, completed
assert completed['pendingRows'] == 0, completed
repeated = upload()
assert repeated.get('duplicateUpload') is True, repeated
print(json.dumps({
    'batchId': completed['id'],
    'documents': [os.environ['DOC_ONE'], os.environ['DOC_TWO']],
    'importedRows': completed['importedRows'],
    'pendingRows': completed['pendingRows'],
    'duplicateUploadBlocked': True,
}))
PY
