#!/usr/bin/env python3
import base64
import cgi
import csv
import hmac
import io
import json
import os
import posixpath
import re
import shutil
import sqlite3
import sys
import urllib.parse
import urllib.request
import uuid
import zipfile
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from xml.etree import ElementTree
from zoneinfo import ZoneInfo


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "participantes.db"
BACKUP_DIR = Path(os.environ.get("BACKUP_DIR", BASE_DIR / "backups"))
if not BACKUP_DIR.is_absolute():
    BACKUP_DIR = BASE_DIR / BACKUP_DIR
BACKUP_RETENTION = max(1, int(os.environ.get("BACKUP_RETENTION", "30")))
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8020"))
APP_TIMEZONE = os.environ.get("TZ", "America/Fortaleza")
APP_TZ = ZoneInfo(APP_TIMEZONE)
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
APP_VERSION = os.environ.get("APP_VERSION", "dev")
APP_BUILD_TIME = os.environ.get("APP_BUILD_TIME", "")
GOOGLE_SHEETS_ENDPOINT = (
    "https://script.google.com/macros/s/"
    "AKfycbxBKdAhwsCb80_XeCz3NC1zN6txDxUj-cJQFcgbcGN6vdrsWJWLUgM41u0xlQHi40Pm/exec"
)
FONTE_GOOGLE_SHEETS = "GOOGLE_SHEETS"
FONTE_SQLITE = "SQLITE"
STATUS_AGUARDANDO = "aguardando"
STATUS_PROXIMO = "próximo da fila"
STATUS_IMPRIMINDO = "imprimindo agora"
STATUS_IMPRESSO = "impresso"
STATUS_ERRO = "erro"
STATUS_CANCELADO = "cancelado"
CONFIG_PRINT_PRINTERS = "fila_impressoras_ativas"
CONFIG_PRINTING_ENABLED = "impressao_ativa"
CONFIG_ACTIVE_PRINT_TEST = "teste_impressao_lote_ativo"
ADMIN_API_ACTIONS = {
    "ativarSQLite",
    "activateSqlite",
    "ativarGoogleSheets",
    "activateGoogleSheets",
    "setFonteDadosAtiva",
    "desativarGoogleSheets",
    "lerRegistros",
    "participants",
    "reimprimirEtiqueta",
    "reprintLabel",
    "limparIndicadores",
    "stats",
    "printTestInfo",
    "startPrintTest",
    "printTestStatus",
    "setPrintingEnabled",
    "iniciarImpressaoFila",
    "pararImpressaoFila",
    "adicionarItemFila",
}

DB_COLUMNS = [
    "ordem_inscricao",
    "numero_ingresso",
    "nome",
    "sobrenome",
    "tipo_ingresso",
    "valor",
    "data_compra",
    "numero_pedido",
    "email",
    "estado_pagamento",
    "checkin",
    "data_checkin",
    "cupom_desconto",
    "identificador_parceiro",
    "metodo_pagamento",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "user_agent",
    "referrer",
    "telefone",
    "cidade",
    "estado",
    "empresa",
    "modulo_sap_area",
    "tamanho_polo_evento",
    "temas_interesse",
]

COLUMN_MAP = {
    "Ordem de inscrição": "ordem_inscricao",
    "Nº ingresso": "numero_ingresso",
    "Nome": "nome",
    "Sobrenome": "sobrenome",
    "Tipo de ingresso": "tipo_ingresso",
    "Valor": "valor",
    "Data compra": "data_compra",
    "Nº pedido": "numero_pedido",
    "Email": "email",
    "Estado de pagamento": "estado_pagamento",
    "Check-in": "checkin",
    "Data Check-in (*)": "data_checkin",
    "Cupom de Desconto": "cupom_desconto",
    "Identificador de Parceiro": "identificador_parceiro",
    "Método de pagamento": "metodo_pagamento",
    "UTM_Source": "utm_source",
    "UTM_Medium": "utm_medium",
    "UTM_Campaign": "utm_campaign",
    "UTM_Term": "utm_term",
    "UTM_Content": "utm_content",
    "User_Agent": "user_agent",
    "Referrer": "referrer",
    "Telefone": "telefone",
    "Cidade": "cidade",
    "Estado": "estado",
    "Empresa onde trabalha": "empresa",
    "Trabalho no Modulo SAP/Area": "modulo_sap_area",
    "Tamanho para polo do evento": "tamanho_polo_evento",
    "Que temas gostaria de ver no evento?": "temas_interesse",
}

REQUIRED_COLUMNS = ["Nome", "Sobrenome", "Email", "Nº ingresso", "Estado de pagamento"]


def normalize_header(value):
    value = str(value or "").strip().lower()
    value = value.replace("º", "o").replace("ª", "a")
    replacements = str.maketrans("áàãâäéèêëíìîïóòõôöúùûüçñ", "aaaaaeeeeiiiiooooouuuucn")
    value = value.translate(replacements)
    return re.sub(r"[^a-z0-9]+", "", value)


NORMALIZED_COLUMN_MAP = {normalize_header(key): value for key, value in COLUMN_MAP.items()}
NORMALIZED_REQUIRED = {normalize_header(key): key for key in REQUIRED_COLUMNS}


def get_connection():
    return sqlite3.connect(DB_PATH)


def create_database():
    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        criarTabelaFilaSQLite(conn)
        criarTabelaConfiguracoesSQLite(conn)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_participantes_email ON participantes(email)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_participantes_numero_ingresso ON participantes(numero_ingresso)")


def create_table(conn):
    criarTabelaParticipantesSQLite(conn)


def criarTabelaParticipantesSQLite(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS participantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ordem_inscricao INTEGER,
            numero_ingresso TEXT,
            nome TEXT,
            sobrenome TEXT,
            tipo_ingresso TEXT,
            valor TEXT,
            data_compra TEXT,
            numero_pedido TEXT,
            email TEXT,
            estado_pagamento TEXT,
            checkin TEXT,
            data_checkin TEXT,
            cupom_desconto TEXT,
            identificador_parceiro TEXT,
            metodo_pagamento TEXT,
            utm_source TEXT,
            utm_medium TEXT,
            utm_campaign TEXT,
            utm_term TEXT,
            utm_content TEXT,
            user_agent TEXT,
            referrer TEXT,
            telefone TEXT,
            cidade TEXT,
            estado TEXT,
            empresa TEXT,
            modulo_sap_area TEXT,
            tamanho_polo_evento TEXT,
            temas_interesse TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    ensure_columns(
        conn,
        "participantes",
        {
            "participante_email": "TEXT",
            "participante_cpf": "TEXT",
            "nome_cracha": "TEXT",
            "sorteio": "TEXT",
            "confirmado_em": "TEXT",
            "criado_em": "TEXT",
            "atualizado_em": "TEXT",
        },
    )


def criarTabelaFilaSQLite(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS fila_impressao (
            id TEXT PRIMARY KEY,
            participante_email TEXT,
            participante_cpf TEXT,
            nome_cracha TEXT NOT NULL,
            empresa TEXT,
            sorteio TEXT,
            status TEXT NOT NULL,
            printer_name TEXT,
            criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
            imprimindo_em TEXT,
            impresso_em TEXT,
            erro TEXT
        )
        """
    )
    ensure_columns(
        conn,
        "fila_impressao",
        {"lote_teste_id": "TEXT", "atraso_simulado_ms": "INTEGER"},
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_fila_status_criado ON fila_impressao(status, criado_em)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_fila_lote_teste ON fila_impressao(lote_teste_id)")


def criarTabelaConfiguracoesSQLite(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS configuracoes (
            chave TEXT PRIMARY KEY,
            valor TEXT,
            atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    defaults = {
        "fonte_dados_ativa": FONTE_GOOGLE_SHEETS,
        "leitura_google_sheets_ativa": "true",
        "leitura_sqlite_ativa": "false",
        "google_sheets_endpoint": GOOGLE_SHEETS_ENDPOINT,
        CONFIG_PRINTING_ENABLED: "false",
        CONFIG_ACTIVE_PRINT_TEST: "",
    }
    for key, value in defaults.items():
        conn.execute(
            """
            INSERT INTO configuracoes (chave, valor, atualizado_em)
            VALUES (?, ?, ?)
            ON CONFLICT(chave) DO NOTHING
            """,
            (key, value, now_iso()),
        )


def ensure_columns(conn, table, columns):
    existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    for name, definition in columns.items():
        if name not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")


def read_file(filename, content):
    suffix = Path(filename or "").suffix.lower()

    if not content:
        raise ValueError("O arquivo enviado está vazio.")

    if suffix == ".csv":
        return read_csv(content)

    if suffix == ".xlsx":
        return read_xlsx(content)

    raise ValueError("Formato inválido. Envie um arquivo CSV ou XLSX.")


def read_csv(content):
    text = decode_text(content)
    sample = text[:4096]
    try:
        delimiter = csv.Sniffer().sniff(sample, delimiters=",;\t|").delimiter if sample.strip() else ","
    except csv.Error:
        delimiter = ","
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))

    if not rows:
        raise ValueError("O arquivo CSV não possui cabeçalhos.")

    return records_from_rows(rows, "CSV")


def decode_text(content):
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue

    raise ValueError("Não foi possível ler o arquivo CSV. Verifique a codificação.")


def read_xlsx(content):
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as workbook:
            shared_strings = read_shared_strings(workbook)
            sheet_path = first_sheet_path(workbook)
            rows = parse_sheet_rows(workbook, sheet_path, shared_strings)
    except zipfile.BadZipFile as exc:
        raise ValueError("Arquivo XLSX inválido ou corrompido.") from exc
    except KeyError as exc:
        raise ValueError("Não foi possível localizar a primeira planilha do XLSX.") from exc

    return records_from_rows(rows, "XLSX")


def records_from_rows(rows, file_type):
    if not rows:
        raise ValueError(f"O arquivo {file_type} está vazio.")

    header_index = find_header_row(rows)
    if header_index is None:
        raise ValueError(
            "Não foi possível localizar a linha de cabeçalhos com as colunas obrigatórias: "
            + ", ".join(REQUIRED_COLUMNS)
            + "."
        )

    headers = [str(value or "").strip() for value in rows[header_index]]
    if not any(headers):
        raise ValueError(f"O arquivo {file_type} não possui cabeçalhos.")

    records = []
    for row in rows[header_index + 1 :]:
        record = {}
        for index, header in enumerate(headers):
            if not header:
                continue
            record[header] = row[index] if index < len(row) else ""
        records.append(record)

    return records, headers


def find_header_row(rows):
    required = set(NORMALIZED_REQUIRED.keys())
    best_index = None
    best_score = 0

    for index, row in enumerate(rows[:50]):
        normalized_cells = {normalize_header(value) for value in row if str(value or "").strip()}
        required_matches = required.intersection(normalized_cells)

        if required.issubset(normalized_cells):
            return index

        known_matches = sum(1 for value in normalized_cells if value in NORMALIZED_COLUMN_MAP)
        score = len(required_matches) * 10 + known_matches

        if score > best_score:
            best_index = index
            best_score = score

    return best_index if best_score >= 30 else None


def read_shared_strings(workbook):
    if "xl/sharedStrings.xml" not in workbook.namelist():
        return []

    root = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
    namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    strings = []

    for item in root.findall("x:si", namespace):
        texts = [node.text or "" for node in item.findall(".//x:t", namespace)]
        strings.append("".join(texts))

    return strings


def first_sheet_path(workbook):
    rels_root = ElementTree.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))
    workbook_root = ElementTree.fromstring(workbook.read("xl/workbook.xml"))
    rel_namespace = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
    book_namespace = {
        "x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }
    relationships = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels_root.findall("r:Relationship", rel_namespace)
    }
    first_sheet = workbook_root.find("x:sheets/x:sheet", book_namespace)

    if first_sheet is None:
        raise KeyError("sheet")

    target = posixpath.normpath(relationships[first_sheet.attrib[f"{{{book_namespace['r']}}}id"]].lstrip("/"))
    return target if target.startswith("xl/") else "xl/" + target


def parse_sheet_rows(workbook, sheet_path, shared_strings):
    root = ElementTree.fromstring(workbook.read(sheet_path))
    namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rows = []

    for row_node in root.findall(".//x:sheetData/x:row", namespace):
        values = []
        for cell in row_node.findall("x:c", namespace):
            cell_ref = cell.attrib.get("r", "")
            column_index = xlsx_column_index(cell_ref)
            while len(values) < column_index:
                values.append("")
            values.append(parse_cell(cell, shared_strings, namespace))
        rows.append(values)

    return rows


def xlsx_column_index(cell_ref):
    letters = re.sub(r"[^A-Z]", "", cell_ref.upper())
    index = 0
    for letter in letters:
        index = index * 26 + ord(letter) - ord("A") + 1
    return max(index - 1, 0)


def parse_cell(cell, shared_strings, namespace):
    cell_type = cell.attrib.get("t")
    value_node = cell.find("x:v", namespace)

    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//x:t", namespace)).strip()

    if value_node is None:
        return ""

    value = value_node.text or ""
    if cell_type == "s":
        try:
            return shared_strings[int(value)].strip()
        except (ValueError, IndexError):
            return ""

    return value.strip()


def normalize_columns(headers):
    normalized = {}

    for header in headers:
        key = normalize_header(header)
        column = NORMALIZED_COLUMN_MAP.get(key)
        if column:
            normalized[header] = column

    return normalized


def validate_required_columns(headers):
    available = {normalize_header(header) for header in headers}
    missing = [label for key, label in NORMALIZED_REQUIRED.items() if key not in available]

    if missing:
        raise ValueError("Colunas obrigatórias ausentes: " + ", ".join(missing) + ".")


def import_participants(records, headers):
    validate_required_columns(headers)
    header_map = normalize_columns(headers)

    if not records:
        raise ValueError("O arquivo não possui registros para importar.")

    participants = []
    for record in records:
        if not any(str(value or "").strip() for value in record.values()):
            continue

        participant = map_record(record, header_map)
        if not has_participant_content(participant):
            continue

        participants.append(participant)

    if not participants:
        raise ValueError("O arquivo não possui participantes válidos para importar.")

    summary = {"processed": 0, "inserted": 0, "updated": 0, "errors": 0, "replaced": True}
    backup_path = backup_database("upload")
    if backup_path:
        summary["backup"] = str(backup_path)

    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        criarTabelaFilaSQLite(conn)
        criarTabelaConfiguracoesSQLite(conn)
        conn.execute("DELETE FROM fila_impressao")
        conn.execute("DELETE FROM participantes")
        conn.execute("DELETE FROM sqlite_sequence WHERE name = 'participantes'")
        set_config(conn, CONFIG_PRINTING_ENABLED, "false")
        set_config(conn, CONFIG_ACTIVE_PRINT_TEST, "")

        for participant in participants:
            summary["processed"] += 1
            error = upsert_participant(conn, participant)
            if error == "inserted":
                summary["inserted"] += 1
            elif error == "updated":
                summary["updated"] += 1
            else:
                raise ValueError("Participante sem email ou número de ingresso não pode ser importado.")

    return summary


def backup_database(reason="manual"):
    if not DB_PATH.exists():
        return None

    safe_reason = re.sub(r"[^a-zA-Z0-9_-]+", "-", str(reason or "manual")).strip("-").lower()
    if not safe_reason:
        safe_reason = "manual"

    timestamp = datetime.now(APP_TZ).strftime("%Y%m%d-%H%M%S-%f")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backup_path = BACKUP_DIR / f"participantes-{safe_reason}-{timestamp}.db"
    shutil.copy2(DB_PATH, backup_path)
    prune_database_backups()
    return backup_path


def prune_database_backups():
    if not BACKUP_DIR.exists():
        return

    backups = sorted(
        (path for path in BACKUP_DIR.glob("participantes-*.db") if path.is_file()),
        key=lambda path: path.name,
        reverse=True,
    )
    for backup in backups[BACKUP_RETENTION:]:
        backup.unlink()


def has_participant_content(participant):
    identity_fields = ["email", "numero_ingresso", "nome", "sobrenome", "estado_pagamento"]
    return any(participant.get(field) for field in identity_fields)


def map_record(record, header_map):
    participant = {column: None for column in DB_COLUMNS}

    for original_header, db_column in header_map.items():
        value = record.get(original_header, "")
        value = str(value or "").strip()
        participant[db_column] = value or None

    if participant["ordem_inscricao"]:
        try:
            participant["ordem_inscricao"] = int(str(participant["ordem_inscricao"]).strip())
        except ValueError:
            participant["ordem_inscricao"] = None

    if participant["email"]:
        participant["email"] = participant["email"].lower()

    return participant


def upsert_participant(conn, participant):
    email = participant.get("email")
    numero_ingresso = participant.get("numero_ingresso")

    if not email and not numero_ingresso:
        return "error"

    existing = find_existing_participant(conn, email, numero_ingresso)
    values = [participant[column] for column in DB_COLUMNS]

    if existing:
        assignments = ", ".join(f"{column} = ?" for column in DB_COLUMNS)
        conn.execute(f"UPDATE participantes SET {assignments} WHERE id = ?", values + [existing])
        atualizarCamposPrincipaisParticipante(conn, existing, participant)
        return "updated"

    columns = ", ".join(DB_COLUMNS)
    placeholders = ", ".join("?" for _ in DB_COLUMNS)
    cursor = conn.execute(f"INSERT INTO participantes ({columns}) VALUES ({placeholders})", values)
    atualizarCamposPrincipaisParticipante(conn, cursor.lastrowid, participant)
    return "inserted"


def atualizarCamposPrincipaisParticipante(conn, participant_id, participant):
    full_name = " ".join(
        value for value in [participant.get("nome"), participant.get("sobrenome")] if value
    ).strip()
    conn.execute(
        """
        UPDATE participantes
        SET participante_email = COALESCE(?, participante_email),
            nome_cracha = COALESCE(?, nome_cracha),
            sorteio = COALESCE(sorteio, ?),
            criado_em = COALESCE(criado_em, NULLIF(created_at, ''), ?),
            atualizado_em = ?
        WHERE id = ?
        """,
        (
            participant.get("email"),
            full_name or None,
            str(participant.get("ordem_inscricao") or "").zfill(3)
            if participant.get("ordem_inscricao")
            else None,
            now_iso(),
            now_iso(),
            participant_id,
        ),
    )


def find_existing_participant(conn, email, numero_ingresso):
    conditions = []
    params = []

    if email:
        conditions.append("LOWER(email) = LOWER(?)")
        params.append(email)

    if numero_ingresso:
        conditions.append("numero_ingresso = ?")
        params.append(numero_ingresso)

    if not conditions:
        return None

    row = conn.execute(
        "SELECT id FROM participantes WHERE " + " OR ".join(conditions) + " ORDER BY id LIMIT 1",
        params,
    ).fetchone()
    return row[0] if row else None


def import_uploaded_file(field):
    filename = field.filename or ""
    content = field.file.read()
    records, headers = read_file(filename, content)
    return import_participants(records, headers)


def now_iso():
    return datetime.now(APP_TZ).replace(tzinfo=None).isoformat(sep=" ", timespec="microseconds")


def set_config(conn, chave, valor):
    conn.execute(
        """
        INSERT INTO configuracoes (chave, valor, atualizado_em)
        VALUES (?, ?, ?)
        ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em
        """,
        (chave, str(valor), now_iso()),
    )


def get_config(conn, chave, default=""):
    row = conn.execute("SELECT valor FROM configuracoes WHERE chave = ?", (chave,)).fetchone()
    return row[0] if row else default


def ativarSQLite():
    return setFonteDadosAtiva(FONTE_SQLITE)


def ativarGoogleSheets():
    return setFonteDadosAtiva(FONTE_GOOGLE_SHEETS)


def setFonteDadosAtiva(fonte):
    fonte = str(fonte or "").strip().upper()
    if fonte not in (FONTE_SQLITE, FONTE_GOOGLE_SHEETS):
        return {"ok": False, "error": "Fonte de dados inválida."}

    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        criarTabelaFilaSQLite(conn)
        criarTabelaConfiguracoesSQLite(conn)
        set_config(conn, "fonte_dados_ativa", fonte)
        set_config(conn, "leitura_google_sheets_ativa", "true" if fonte == FONTE_GOOGLE_SHEETS else "false")
        set_config(conn, "leitura_sqlite_ativa", "true" if fonte == FONTE_SQLITE else "false")

    return {"ok": True, "fonteDadosAtiva": fonte}


def desativarGoogleSheets():
    with get_connection() as conn:
        criarTabelaConfiguracoesSQLite(conn)
        set_config(conn, "leitura_google_sheets_ativa", "false")
    return {"ok": True}


def getFonteDadosAtiva():
    with get_connection() as conn:
        criarTabelaConfiguracoesSQLite(conn)
        fonte = get_config(conn, "fonte_dados_ativa", FONTE_GOOGLE_SHEETS)
        return {
            "ok": True,
            "fonteDadosAtiva": fonte,
            "leituraGoogleSheetsAtiva": get_config(conn, "leitura_google_sheets_ativa", "true") == "true",
            "leituraSqliteAtiva": get_config(conn, "leitura_sqlite_ativa", "false") == "true",
            "googleSheetsEndpointConfigurado": bool(get_config(conn, "google_sheets_endpoint", GOOGLE_SHEETS_ENDPOINT)),
        }


def lerRegistros(limit=1000):
    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        rows = conn.execute(
            """
            SELECT id,
                   COALESCE(participante_email, email) AS participante_email,
                   participante_cpf,
                   COALESCE(nome_cracha, TRIM(COALESCE(nome, '') || ' ' || COALESCE(sobrenome, ''))) AS nome_cracha,
                   empresa,
                   COALESCE(sorteio, printf('%03d', COALESCE(ordem_inscricao, id))) AS sorteio,
                   confirmado_em,
                   COALESCE(criado_em, created_at) AS criado_em,
                   atualizado_em
            FROM participantes
            ORDER BY id
            LIMIT ?
            """,
            (int(limit),),
        ).fetchall()
    return [dict_from_row(row, ["id", "participante_email", "participante_cpf", "nome_cracha", "empresa", "sorteio", "confirmado_em", "criado_em", "atualizado_em"]) for row in rows]


def lookup_participante(lookup):
    normalized = str(lookup or "").strip().lower()
    cpf = re.sub(r"\D", "", normalized)
    where_clause, params = build_participant_lookup_filter(normalized, cpf)

    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        row = conn.execute(
            f"""
            SELECT id,
                   COALESCE(participante_email, email) AS email,
                   participante_cpf AS cpf,
                   nome,
                   sobrenome,
                   COALESCE(nome_cracha, TRIM(COALESCE(nome, '') || ' ' || COALESCE(sobrenome, ''))) AS badge_name,
                   empresa,
                   COALESCE(sorteio, printf('%03d', COALESCE(ordem_inscricao, id))) AS sorteio,
                   confirmado_em
            FROM participantes
            WHERE {where_clause}
            ORDER BY id
            LIMIT 1
            """,
            params,
        ).fetchone()

    if not row:
        return {"ok": True, "found": False}

    return participant_response(row)


def confirmar_participante(lookup, company="", badge_name=""):
    normalized = str(lookup or "").strip().lower()
    cpf = re.sub(r"\D", "", normalized)
    confirmed_at = now_iso()
    where_clause, params = build_participant_lookup_filter(normalized, cpf)

    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        row = conn.execute(
            f"""
            SELECT id,
                   COALESCE(participante_email, email) AS email,
                   participante_cpf AS cpf,
                   nome,
                   sobrenome,
                   COALESCE(nome_cracha, TRIM(COALESCE(nome, '') || ' ' || COALESCE(sobrenome, ''))) AS badge_name,
                   empresa,
                   COALESCE(sorteio, printf('%03d', COALESCE(ordem_inscricao, id))) AS sorteio,
                   confirmado_em
            FROM participantes
            WHERE {where_clause}
            ORDER BY id
            LIMIT 1
            """,
            params,
        ).fetchone()

        if not row:
            return {"ok": True, "found": False}

        existing_confirmed_at = row[8]
        final_badge_name = str(badge_name or row[5] or "Participante").strip()
        final_company = str(company or row[6] or "").strip()
        conn.execute(
            """
            UPDATE participantes
            SET nome_cracha = ?, empresa = ?, confirmado_em = COALESCE(confirmado_em, ?), atualizado_em = ?
            WHERE id = ?
            """,
            (final_badge_name, final_company, confirmed_at, now_iso(), row[0]),
        )

        print_job = None
        already_confirmed = bool(existing_confirmed_at)
        if not already_confirmed:
            print_job = adicionarItemFila(
                participante_email=row[1],
                participante_cpf=row[2],
                nome_cracha=final_badge_name,
                empresa=final_company,
                sorteio=row[7],
                conn=conn,
            )

        updated = conn.execute(
            """
            SELECT id,
                   COALESCE(participante_email, email) AS email,
                   participante_cpf AS cpf,
                   nome,
                   sobrenome,
                   COALESCE(nome_cracha, TRIM(COALESCE(nome, '') || ' ' || COALESCE(sobrenome, ''))) AS badge_name,
                   empresa,
                   COALESCE(sorteio, printf('%03d', COALESCE(ordem_inscricao, id))) AS sorteio,
                   confirmado_em
            FROM participantes
            WHERE id = ?
            """,
            (row[0],),
        ).fetchone()

    response = participant_response(updated)
    response["alreadyConfirmed"] = already_confirmed
    response["printJob"] = print_job
    return response


def reimprimirEtiqueta(lookup, company="", badge_name=""):
    normalized = str(lookup or "").strip().lower()
    cpf = re.sub(r"\D", "", normalized)
    where_clause, params = build_participant_lookup_filter(normalized, cpf)

    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        row = conn.execute(
            f"""
            SELECT id,
                   COALESCE(participante_email, email) AS email,
                   participante_cpf AS cpf,
                   nome,
                   sobrenome,
                   COALESCE(nome_cracha, TRIM(COALESCE(nome, '') || ' ' || COALESCE(sobrenome, ''))) AS badge_name,
                   empresa,
                   COALESCE(sorteio, printf('%03d', COALESCE(ordem_inscricao, id))) AS sorteio,
                   confirmado_em
            FROM participantes
            WHERE {where_clause}
            ORDER BY id
            LIMIT 1
            """,
            params,
        ).fetchone()

        if not row:
            return {"ok": True, "found": False}

        final_badge_name = str(badge_name or row[5] or "Participante").strip()
        final_company = str(company or row[6] or "").strip()
        conn.execute(
            """
            UPDATE participantes
            SET nome_cracha = ?, empresa = ?, atualizado_em = ?
            WHERE id = ?
            """,
            (final_badge_name, final_company, now_iso(), row[0]),
        )
        print_job = adicionarItemFila(
            participante_email=row[1],
            participante_cpf=row[2],
            nome_cracha=final_badge_name,
            empresa=final_company,
            sorteio=row[7],
            conn=conn,
        )
        updated = conn.execute(
            """
            SELECT id,
                   COALESCE(participante_email, email) AS email,
                   participante_cpf AS cpf,
                   nome,
                   sobrenome,
                   COALESCE(nome_cracha, TRIM(COALESCE(nome, '') || ' ' || COALESCE(sobrenome, ''))) AS badge_name,
                   empresa,
                   COALESCE(sorteio, printf('%03d', COALESCE(ordem_inscricao, id))) AS sorteio,
                   confirmado_em
            FROM participantes
            WHERE id = ?
            """,
            (row[0],),
        ).fetchone()

    response = participant_response(updated)
    response["reprinted"] = True
    response["printJob"] = print_job
    return response


def build_participant_lookup_filter(normalized_lookup, cpf_lookup):
    if "@" in normalized_lookup:
        return "LOWER(COALESCE(participante_email, email, '')) = ?", (normalized_lookup,)

    if cpf_lookup:
        return (
            "REPLACE(REPLACE(REPLACE(COALESCE(participante_cpf, ''), '.', ''), '-', ''), ' ', '') = ?",
            (cpf_lookup,),
        )

    return "1 = 0", ()


def participant_response(row):
    name = str(row[3] or row[5] or "Participante").strip()
    surname = str(row[4] or "").strip()
    suggested_badge_name = " ".join([name, surname]).strip() or name or "Participante"
    badge_name = str(row[5] or " ".join([name, surname]).strip() or "Participante").strip()
    return {
        "ok": True,
        "found": True,
        "id": row[0],
        "email": row[1] or "",
        "cpf": row[2] or "",
        "name": name,
        "surname": surname,
        "badgeName": badge_name,
        "badgeNameSuggested": suggested_badge_name,
        "number": row[7] or "000",
        "company": row[6] or "",
        "confirmed": bool(row[8]),
        "confirmedAt": row[8] or "",
    }


def adicionarItemFila(
    participante_email="",
    participante_cpf="",
    nome_cracha="",
    empresa="",
    sorteio="",
    conn=None,
    lote_teste_id="",
    atraso_simulado_ms=None,
):
    owns_connection = conn is None
    conn = conn or get_connection()
    try:
        criarTabelaFilaSQLite(conn)
        job_id = uuid.uuid4().hex
        criado_em = now_iso()
        conn.execute(
            """
            INSERT INTO fila_impressao
              (id, participante_email, participante_cpf, nome_cracha, empresa, sorteio, status, printer_name, criado_em, imprimindo_em, impresso_em, erro, lote_teste_id, atraso_simulado_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, NULL, ?, ?)
            """,
            (
                job_id,
                participante_email or "",
                participante_cpf or "",
                nome_cracha or "Participante",
                empresa or "",
                sorteio or "",
                STATUS_AGUARDANDO,
                criado_em,
                lote_teste_id or None,
                atraso_simulado_ms,
            ),
        )
        if owns_connection:
            conn.commit()
        position = get_queue_position(conn, job_id)
        return {
            "id": job_id,
            "status": STATUS_AGUARDANDO,
            "position": position,
            "badgeName": nome_cracha or "Participante",
            "company": empresa or "",
            "raffleNumber": sorteio or "",
        }
    finally:
        if owns_connection:
            conn.close()


def obterProximoDaFila(conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    try:
        criarTabelaFilaSQLite(conn)
        row = conn.execute(
            """
            SELECT * FROM fila_impressao
            WHERE status = ?
            ORDER BY criado_em ASC, id ASC
            LIMIT 1
            """,
            (STATUS_AGUARDANDO,),
        ).fetchone()
        return fila_row_to_api(row, conn) if row else None
    finally:
        if owns_connection:
            conn.close()


def atualizarStatusFila(job_id, status, printer_name=None, erro=None, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    try:
        criarTabelaFilaSQLite(conn)
        conn.execute(
            "UPDATE fila_impressao SET status = ?, printer_name = COALESCE(?, printer_name), erro = COALESCE(?, erro) WHERE id = ?",
            (status, printer_name, erro, job_id),
        )
        if owns_connection:
            conn.commit()
        return {"ok": True}
    finally:
        if owns_connection:
            conn.close()


def marcarComoProximoDaFila(job_id, printer_name="", conn=None):
    return atualizarStatusFila(job_id, STATUS_PROXIMO, printer_name or None, None, conn)


def iniciarImpressao(job_id, printer_name, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    try:
        criarTabelaFilaSQLite(conn)
        conn.execute(
            """
            UPDATE fila_impressao
            SET status = ?, imprimindo_em = ?, printer_name = ?, erro = NULL
            WHERE id = ?
            """,
            (STATUS_IMPRIMINDO, now_iso(), printer_name, job_id),
        )
        if owns_connection:
            conn.commit()
        return {"ok": True}
    finally:
        if owns_connection:
            conn.close()


def finalizarImpressao(job_id, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    try:
        criarTabelaFilaSQLite(conn)
        conn.execute(
            "UPDATE fila_impressao SET status = ?, impresso_em = ? WHERE id = ?",
            (STATUS_IMPRESSO, now_iso(), job_id),
        )
        batch_row = conn.execute(
            "SELECT lote_teste_id FROM fila_impressao WHERE id = ?",
            (job_id,),
        ).fetchone()
        finishPrintTestIfComplete(batch_row[0] if batch_row else "", conn)
        if owns_connection:
            conn.commit()
        return {"ok": True}
    finally:
        if owns_connection:
            conn.close()


def registrarErroImpressao(job_id, error_message, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    try:
        criarTabelaFilaSQLite(conn)
        conn.execute(
            "UPDATE fila_impressao SET status = ?, erro = ? WHERE id = ?",
            (STATUS_ERRO, error_message or "Erro de impressão", job_id),
        )
        batch_row = conn.execute(
            "SELECT lote_teste_id FROM fila_impressao WHERE id = ?",
            (job_id,),
        ).fetchone()
        finishPrintTestIfComplete(batch_row[0] if batch_row else "", conn)
        if owns_connection:
            conn.commit()
        return {"ok": True}
    finally:
        if owns_connection:
            conn.close()


def cancelarItemFila(job_id, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    try:
        result = atualizarStatusFila(job_id, STATUS_CANCELADO, conn=conn)
        batch_row = conn.execute(
            "SELECT lote_teste_id FROM fila_impressao WHERE id = ?",
            (job_id,),
        ).fetchone()
        finishPrintTestIfComplete(batch_row[0] if batch_row else "", conn)
        if owns_connection:
            conn.commit()
        return result
    finally:
        if owns_connection:
            conn.close()


def getPrintTestInfo():
    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        criarTabelaFilaSQLite(conn)
        criarTabelaConfiguracoesSQLite(conn)
        source = get_config(conn, "fonte_dados_ativa", FONTE_GOOGLE_SHEETS)
        pending = conn.execute(
            "SELECT COUNT(*) FROM participantes WHERE confirmado_em IS NULL OR confirmado_em = ''"
        ).fetchone()[0]
        active_queue = conn.execute(
            "SELECT COUNT(*) FROM fila_impressao WHERE status IN (?, ?, ?)",
            (STATUS_AGUARDANDO, STATUS_PROXIMO, STATUS_IMPRIMINDO),
        ).fetchone()[0]
        active_batch_id = get_config(conn, CONFIG_ACTIVE_PRINT_TEST, "")
        printers = get_print_printers(conn)
    return {
        "ok": True,
        "source": source,
        "pending": pending,
        "printers": printers,
        "printerCount": len(printers),
        "activeQueue": active_queue,
        "activeBatchId": active_batch_id,
        "canStart": source == FONTE_SQLITE and pending > 0 and active_queue == 0 and not active_batch_id,
    }


def startPrintTest(quantity, delay_seconds=None):
    try:
        requested = int(quantity)
    except (TypeError, ValueError):
        return {"ok": False, "error": "Informe uma quantidade válida para o teste."}
    if requested < 1:
        return {"ok": False, "error": "A quantidade do teste deve ser maior que zero."}
    try:
        delay = int(delay_seconds) if delay_seconds is not None else 3
    except (TypeError, ValueError):
        delay = 3
    delay = min(max(delay, 1), 10)

    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        criarTabelaFilaSQLite(conn)
        criarTabelaConfiguracoesSQLite(conn)
        conn.commit()
        conn.execute("BEGIN IMMEDIATE")

        source = get_config(conn, "fonte_dados_ativa", FONTE_GOOGLE_SHEETS)
        if source != FONTE_SQLITE:
            return {"ok": False, "error": "O teste de impressão exige a fonte SQLite."}

        active_batch_id = get_config(conn, CONFIG_ACTIVE_PRINT_TEST, "")
        if active_batch_id:
            return {"ok": False, "error": "Já existe um teste de impressão em andamento."}

        active_queue = conn.execute(
            "SELECT COUNT(*) FROM fila_impressao WHERE status IN (?, ?, ?)",
            (STATUS_AGUARDANDO, STATUS_PROXIMO, STATUS_IMPRIMINDO),
        ).fetchone()[0]
        if active_queue:
            return {"ok": False, "error": "A fila de impressão precisa estar vazia antes do teste."}

        rows = conn.execute(
            """
            SELECT id,
                   COALESCE(participante_email, email) AS email,
                   participante_cpf,
                   COALESCE(nome_cracha, TRIM(COALESCE(nome, '') || ' ' || COALESCE(sobrenome, ''))) AS badge_name,
                   empresa,
                   COALESCE(sorteio, printf('%03d', COALESCE(ordem_inscricao, id))) AS sorteio
            FROM participantes
            WHERE confirmado_em IS NULL OR confirmado_em = ''
            ORDER BY CASE WHEN ordem_inscricao IS NULL THEN 1 ELSE 0 END, ordem_inscricao, id
            """
        ).fetchall()
        if not rows:
            return {"ok": False, "error": "Não há participantes pendentes para o teste."}

        selected = rows[: min(requested, len(rows))]
        batch_id = uuid.uuid4().hex
        confirmed_at = now_iso()
        job_ids = []
        for row in selected:
            badge_name = str(row[3] or "Participante").strip() or "Participante"
            conn.execute(
                """
                UPDATE participantes
                SET nome_cracha = ?, confirmado_em = ?, atualizado_em = ?
                WHERE id = ?
                """,
                (badge_name, confirmed_at, confirmed_at, row[0]),
            )
            job = adicionarItemFila(
                participante_email=row[1],
                participante_cpf=row[2],
                nome_cracha=badge_name,
                empresa=row[4],
                sorteio=row[5],
                conn=conn,
                lote_teste_id=batch_id,
                atraso_simulado_ms=delay * 1000,
            )
            job_ids.append(job["id"])

        set_config(conn, CONFIG_ACTIVE_PRINT_TEST, batch_id)
        set_config(conn, CONFIG_PRINTING_ENABLED, "true")
        conn.commit()
        return {
            "ok": True,
            "batchId": batch_id,
            "requested": requested,
            "total": len(selected),
            "delaySeconds": delay,
            "availableBeforeStart": len(rows),
            "jobIds": job_ids,
            "printingEnabled": True,
        }


def getPrintTestStatus(batch_id):
    batch_id = str(batch_id or "").strip()
    if not batch_id:
        return {"ok": False, "error": "Identificador do lote não informado."}
    with get_connection() as conn:
        criarTabelaFilaSQLite(conn)
        criarTabelaConfiguracoesSQLite(conn)
        counts = dict(
            conn.execute(
                "SELECT status, COUNT(*) FROM fila_impressao WHERE lote_teste_id = ? GROUP BY status",
                (batch_id,),
            ).fetchall()
        )
        total = sum(counts.values())
        waiting = counts.get(STATUS_AGUARDANDO, 0) + counts.get(STATUS_PROXIMO, 0)
        printing = counts.get(STATUS_IMPRIMINDO, 0)
        printed = counts.get(STATUS_IMPRESSO, 0)
        errors = counts.get(STATUS_ERRO, 0)
        cancelled = counts.get(STATUS_CANCELADO, 0)
        completed_count = printed + errors + cancelled
        printing_enabled = is_printing_enabled(conn)
    return {
        "ok": True,
        "batchId": batch_id,
        "total": total,
        "aguardando": waiting,
        "imprimindo": printing,
        "impresso": printed,
        "erro": errors,
        "cancelado": cancelled,
        "completedCount": completed_count,
        "progress": round((completed_count / total) * 100, 1) if total else 0,
        "completed": total > 0 and waiting == 0 and printing == 0,
        "printingEnabled": printing_enabled,
    }


def finishPrintTestIfComplete(batch_id, conn=None):
    batch_id = str(batch_id or "").strip()
    if not batch_id:
        return False
    owns_connection = conn is None
    conn = conn or get_connection()
    try:
        criarTabelaFilaSQLite(conn)
        criarTabelaConfiguracoesSQLite(conn)
        active = conn.execute(
            """
            SELECT COUNT(*) FROM fila_impressao
            WHERE lote_teste_id = ? AND status IN (?, ?, ?)
            """,
            (batch_id, STATUS_AGUARDANDO, STATUS_PROXIMO, STATUS_IMPRIMINDO),
        ).fetchone()[0]
        total = conn.execute(
            "SELECT COUNT(*) FROM fila_impressao WHERE lote_teste_id = ?",
            (batch_id,),
        ).fetchone()[0]
        if total and not active:
            set_config(conn, CONFIG_PRINTING_ENABLED, "false")
            if get_config(conn, CONFIG_ACTIVE_PRINT_TEST, "") == batch_id:
                set_config(conn, CONFIG_ACTIVE_PRINT_TEST, "")
            if owns_connection:
                conn.commit()
            return True
        return False
    finally:
        if owns_connection:
            conn.close()


def claimPrintJob(printer):
    with get_connection() as conn:
        criarTabelaFilaSQLite(conn)
        criarTabelaConfiguracoesSQLite(conn)
        conn.commit()
        if not is_printing_enabled(conn):
            return {"ok": True, "job": None, "printingEnabled": False}
        conn.execute("BEGIN IMMEDIATE")
        job = obterProximoDaFila(conn)
        if not job:
            return {"ok": True, "job": None}
        marcarComoProximoDaFila(job["id"], printer, conn)
        iniciarImpressao(job["id"], printer, conn)
        row = conn.execute("SELECT * FROM fila_impressao WHERE id = ?", (job["id"],)).fetchone()
        return {"ok": True, "job": fila_row_to_api(row, conn)}


def completePrintJob(job_id, printer=""):
    return finalizarImpressao(job_id)


def failPrintJob(job_id, printer="", error_message=""):
    return registrarErroImpressao(job_id, error_message)


def is_printing_enabled(conn):
    return get_config(conn, CONFIG_PRINTING_ENABLED, "true") == "true"


def setPrintingEnabled(enabled):
    enabled = str(enabled).strip().lower() in ("1", "true", "sim", "yes", "on", "iniciar", "start")
    with get_connection() as conn:
        criarTabelaConfiguracoesSQLite(conn)
        set_config(conn, CONFIG_PRINTING_ENABLED, "true" if enabled else "false")

    return {"ok": True, "printingEnabled": enabled}


def pause_printing_on_startup():
    with get_connection() as conn:
        criarTabelaConfiguracoesSQLite(conn)
        set_config(conn, CONFIG_PRINTING_ENABLED, "false")


def syncPrintPrinters(printers):
    if isinstance(printers, str):
        try:
            parsed = json.loads(printers)
        except json.JSONDecodeError:
            parsed = [item.strip() for item in printers.split(",")]
    else:
        parsed = printers

    if not isinstance(parsed, list):
        parsed = []

    names = []
    for item in parsed:
        name = item.get("name") if isinstance(item, dict) else item
        name = str(name or "").strip()
        if name and name not in names:
            names.append(name)

    with get_connection() as conn:
        criarTabelaConfiguracoesSQLite(conn)
        set_config(conn, CONFIG_PRINT_PRINTERS, json.dumps(names, ensure_ascii=False))

    return {"ok": True, "printers": names}


def get_print_printers(conn):
    criarTabelaConfiguracoesSQLite(conn)
    raw = get_config(conn, CONFIG_PRINT_PRINTERS, "[]")
    try:
        printers = json.loads(raw)
    except json.JSONDecodeError:
        printers = []

    return [
        str(printer or "").strip()
        for printer in printers
        if str(printer or "").strip()
    ]


def get_queue_position(conn, job_id):
    rows = conn.execute(
        "SELECT id FROM fila_impressao WHERE status = ? ORDER BY criado_em ASC, id ASC",
        (STATUS_AGUARDANDO,),
    ).fetchall()
    for index, row in enumerate(rows, 1):
        if row[0] == job_id:
            return index
    return None


def fila_row_to_api(row, conn, predicted_printer=None):
    if not row:
        return None
    columns = [item[1] for item in conn.execute("PRAGMA table_info(fila_impressao)").fetchall()]
    item = dict(zip(columns, row))
    position = get_queue_position(conn, item["id"]) if item["status"] == STATUS_AGUARDANDO else None
    printer = item["printer_name"] or predicted_printer or ""
    return {
        "id": item["id"],
        "participantEmail": item["participante_email"] or "",
        "participantCpf": item["participante_cpf"] or "",
        "badgeName": item["nome_cracha"],
        "company": item["empresa"] or "",
        "raffleNumber": item["sorteio"] or "000",
        "status": item["status"],
        "printer": printer,
        "printerPredicted": bool(predicted_printer and not item["printer_name"]),
        "createdAt": item["criado_em"] or "",
        "printingAt": item["imprimindo_em"] or "",
        "printedAt": item["impresso_em"] or "",
        "error": item["erro"] or "",
        "batchId": item.get("lote_teste_id") or "",
        "simulationDelayMs": item.get("atraso_simulado_ms"),
        "queuePosition": position,
        "pickupText": pickup_text(item),
    }


def pickup_text(item):
    if item["status"] in (STATUS_PROXIMO, STATUS_IMPRIMINDO):
        return f"{item['nome_cracha']} — Retirar o crachá na impressora {item['printer_name'] or ''}".strip()
    return ""


def getPrintQueueStats(limit=20):
    with get_connection() as conn:
        criarTabelaFilaSQLite(conn)
        printers = get_print_printers(conn)
        printing_enabled = is_printing_enabled(conn)
        counts = dict(
            conn.execute(
                "SELECT status, COUNT(*) FROM fila_impressao GROUP BY status"
            ).fetchall()
        )
        rows = conn.execute(
            """
            SELECT * FROM fila_impressao
            WHERE status IN (?, ?, ?, ?)
            ORDER BY criado_em ASC
            LIMIT ?
            """,
            (STATUS_IMPRIMINDO, STATUS_PROXIMO, STATUS_AGUARDANDO, STATUS_ERRO, int(limit)),
        ).fetchall()
        jobs = []
        waiting_index = 0
        for row in rows:
            status = row[6]
            predicted_printer = None
            if status == STATUS_AGUARDANDO and printers:
                predicted_printer = printers[waiting_index % len(printers)]
                waiting_index += 1
            jobs.append(fila_row_to_api(row, conn, predicted_printer))

    return {
        "ok": True,
        "aguardando": counts.get(STATUS_AGUARDANDO, 0) + counts.get(STATUS_PROXIMO, 0),
        "imprimindo": counts.get(STATUS_IMPRIMINDO, 0),
        "impresso": counts.get(STATUS_IMPRESSO, 0),
        "erro": counts.get(STATUS_ERRO, 0),
        "cancelado": counts.get(STATUS_CANCELADO, 0),
        "printingEnabled": printing_enabled,
        "printers": printers,
        "printerCount": len(printers),
        "jobs": jobs,
        "updatedAt": datetime.now(APP_TZ).strftime("%H:%M:%S"),
    }


def build_company_stats(company_rows, no_company, total):
    top_companies = list(company_rows[:6])
    other_count = sum(row[1] for row in company_rows[6:])
    groups = [(row[0], row[1]) for row in top_companies]
    if other_count:
        groups.append(("Outras empresas", other_count))
    if no_company:
        groups.append(("Sem empresa", no_company))
    return [
        {
            "name": name,
            "count": count,
            "rate": round((count / total) * 100, 1) if total else 0,
        }
        for name, count in groups
    ]


def getStats():
    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        total = conn.execute("SELECT COUNT(*) FROM participantes").fetchone()[0]
        confirmed = conn.execute(
            "SELECT COUNT(*) FROM participantes WHERE confirmado_em IS NOT NULL AND confirmado_em <> ''"
        ).fetchone()[0]
        company_rows = conn.execute(
            """
            SELECT TRIM(empresa) AS company,
                   COUNT(*) AS total
            FROM participantes
            WHERE TRIM(COALESCE(empresa, '')) <> ''
            GROUP BY company
            ORDER BY total DESC, company COLLATE NOCASE ASC
            """
        ).fetchall()
        no_company = conn.execute(
            "SELECT COUNT(*) FROM participantes WHERE TRIM(COALESCE(empresa, '')) = ''"
        ).fetchone()[0]
        recent_rows = conn.execute(
            """
            SELECT COALESCE(nome_cracha, TRIM(COALESCE(nome, '') || ' ' || COALESCE(sobrenome, ''))) AS nome,
                   COALESCE(participante_email, email) AS email,
                   COALESCE(sorteio, printf('%03d', COALESCE(ordem_inscricao, id))) AS sorteio,
                   confirmado_em
            FROM participantes
            WHERE confirmado_em IS NOT NULL AND confirmado_em <> ''
            ORDER BY confirmado_em DESC
            LIMIT 8
            """
        ).fetchall()
    pending = max(total - confirmed, 0)
    return {
        "ok": True,
        "total": total,
        "confirmed": confirmed,
        "pending": pending,
        "confirmedRate": round((confirmed / total) * 100, 1) if total else 0,
        "pendingRate": round((pending / total) * 100, 1) if total else 0,
        "hourly": [0] * 24,
        "companies": build_company_stats(company_rows, no_company, total),
        "recent": [
            {"name": row[0] or "Participante", "email": row[1] or "", "number": row[2] or "000", "time": str(row[3] or "")[11:16]}
            for row in recent_rows
        ],
        "updatedAt": datetime.now(APP_TZ).strftime("%H:%M"),
    }


def limparIndicadores():
    with get_connection() as conn:
        criarTabelaParticipantesSQLite(conn)
        criarTabelaFilaSQLite(conn)
        conn.execute("DELETE FROM fila_impressao")
        conn.execute("DELETE FROM participantes")
        conn.execute("DELETE FROM sqlite_sequence WHERE name = 'participantes'")

    return {
        "ok": True,
        "cleared": True,
        "stats": getStats(),
        "printQueue": getPrintQueueStats(),
    }


def dict_from_row(row, keys):
    return {key: row[index] for index, key in enumerate(keys)}


def get_active_data_source():
    with get_connection() as conn:
        criarTabelaConfiguracoesSQLite(conn)
        return get_config(conn, "fonte_dados_ativa", FONTE_GOOGLE_SHEETS)


def get_google_sheets_endpoint():
    with get_connection() as conn:
        criarTabelaConfiguracoesSQLite(conn)
        return get_config(conn, "google_sheets_endpoint", GOOGLE_SHEETS_ENDPOINT)


def get_latest_backup_info():
    if not BACKUP_DIR.exists():
        return None, 0

    backups = sorted(
        (path for path in BACKUP_DIR.glob("participantes-*.db") if path.is_file()),
        key=lambda path: path.name,
        reverse=True,
    )
    if not backups:
        return None, 0

    latest = backups[0]
    return {
        "name": latest.name,
        "sizeBytes": latest.stat().st_size,
        "modifiedAt": datetime.fromtimestamp(latest.stat().st_mtime, APP_TZ).isoformat(timespec="seconds"),
    }, len(backups)


def getVersionInfo():
    last_backup, backup_count = get_latest_backup_info()
    return {
        "ok": True,
        "version": APP_VERSION,
        "buildTime": APP_BUILD_TIME,
        "timeZone": APP_TIMEZONE,
        "fonteDadosAtiva": get_active_data_source(),
        "adminAuthEnabled": bool(ADMIN_PASSWORD),
        "databaseExists": DB_PATH.exists(),
        "backupCount": backup_count,
        "lastBackup": last_backup,
        "updatedAt": datetime.now(APP_TZ).isoformat(timespec="seconds"),
    }


def should_proxy_to_google_sheets(action):
    local_actions = {
        "fonteDados",
        "getFonteDadosAtiva",
        "ativarSQLite",
        "activateSqlite",
        "ativarGoogleSheets",
        "activateGoogleSheets",
        "setFonteDadosAtiva",
        "desativarGoogleSheets",
        "lerRegistros",
        "participants",
        "adicionarItemFila",
        "reimprimirEtiqueta",
        "reprintLabel",
        "syncPrintPrinters",
        "updatePrintPrinters",
        "setPrintingEnabled",
        "iniciarImpressaoFila",
        "pararImpressaoFila",
        "printTestInfo",
        "startPrintTest",
        "printTestStatus",
        "version",
    }
    return action not in local_actions and get_active_data_source() == FONTE_GOOGLE_SHEETS


def proxy_google_sheets_action(params):
    endpoint = get_google_sheets_endpoint()
    if not endpoint:
        return {"ok": False, "error": "Endpoint do Google Sheets não configurado."}

    query_params = {
        key: value
        for key, value in params.items()
        if key not in ("callback", "_") and value is not None
    }
    url = endpoint + ("&" if "?" in endpoint else "?") + urllib.parse.urlencode(query_params)

    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            body = response.read().decode("utf-8")
    except Exception as exc:
        return {"ok": False, "error": "Falha ao consultar Google Sheets: " + str(exc)}

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {"ok": False, "error": "Resposta inválida do Google Sheets."}


def handle_api_action(params):
    action = str(params.get("action", "fonteDados")).strip()
    if should_proxy_to_google_sheets(action):
        return proxy_google_sheets_action(params)

    if action in ("ativarSQLite", "activateSqlite"):
        return ativarSQLite()
    if action in ("ativarGoogleSheets", "activateGoogleSheets"):
        return ativarGoogleSheets()
    if action == "setFonteDadosAtiva":
        return setFonteDadosAtiva(params.get("fonte", params.get("fonteDadosAtiva", "")))
    if action == "desativarGoogleSheets":
        return desativarGoogleSheets()
    if action in ("fonteDados", "getFonteDadosAtiva"):
        return getFonteDadosAtiva()
    if action == "version":
        return getVersionInfo()
    if action in ("lerRegistros", "participants"):
        return {"ok": True, "records": lerRegistros(int(params.get("limit", 1000)))}
    if action == "lookup":
        return lookup_participante(params.get("lookup", ""))
    if action == "confirm":
        return confirmar_participante(
            params.get("lookup", ""),
            params.get("company", ""),
            params.get("badgeName", ""),
        )
    if action in ("reimprimirEtiqueta", "reprintLabel"):
        return reimprimirEtiqueta(
            params.get("lookup", ""),
            params.get("company", ""),
            params.get("badgeName", ""),
        )
    if action == "limparIndicadores":
        return limparIndicadores()
    if action == "stats":
        return getStats()
    if action in ("printQueue", "printQueueStats"):
        return getPrintQueueStats(int(params.get("limit", 20)))
    if action == "printTestInfo":
        return getPrintTestInfo()
    if action == "startPrintTest":
        return startPrintTest(params.get("quantity", 0), params.get("delaySeconds"))
    if action == "printTestStatus":
        return getPrintTestStatus(params.get("batchId", ""))
    if action == "claimPrintJob":
        return claimPrintJob(params.get("printer", ""))
    if action == "completePrintJob":
        return completePrintJob(params.get("jobId", ""), params.get("printer", ""))
    if action == "failPrintJob":
        return failPrintJob(params.get("jobId", ""), params.get("printer", ""), params.get("error", ""))
    if action in ("syncPrintPrinters", "updatePrintPrinters"):
        return syncPrintPrinters(params.get("printers", "[]"))
    if action == "setPrintingEnabled":
        return setPrintingEnabled(params.get("enabled", "false"))
    if action == "iniciarImpressaoFila":
        return setPrintingEnabled("true")
    if action == "pararImpressaoFila":
        return setPrintingEnabled("false")
    if action == "adicionarItemFila":
        return {"ok": True, "job": adicionarItemFila(
            params.get("participante_email", ""),
            params.get("participante_cpf", ""),
            params.get("nome_cracha", ""),
            params.get("empresa", ""),
            params.get("sorteio", ""),
        )}
    return {"ok": False, "error": f"Ação não suportada: {action}"}


class AdminRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def request_path(self):
        return urllib.parse.urlparse(getattr(self, "path", "")).path

    def request_action(self):
        query = urllib.parse.urlparse(getattr(self, "path", "")).query
        params = urllib.parse.parse_qs(query)
        return str(params.get("action", ["fonteDados"])[-1]).strip()

    def should_disable_cache(self):
        path = self.request_path()
        return path == "/api" or path.endswith(".html") or path == "/"

    def request_requires_admin_auth(self):
        if not ADMIN_PASSWORD:
            return False

        path = self.request_path()
        if path in ("/admin.html", "/admin/upload-participantes"):
            return True

        return path == "/api" and self.request_action() in ADMIN_API_ACTIONS

    def is_admin_authorized(self):
        if not self.request_requires_admin_auth():
            return True

        authorization = self.headers.get("Authorization", "")
        if not authorization.startswith("Basic "):
            return False

        try:
            raw_credentials = base64.b64decode(authorization[6:], validate=True).decode("utf-8")
        except Exception:
            return False

        username, separator, password = raw_credentials.partition(":")
        if not separator:
            return False

        return hmac.compare_digest(username, ADMIN_USERNAME) and hmac.compare_digest(password, ADMIN_PASSWORD)

    def reject_admin_auth(self):
        body = json.dumps({"ok": False, "error": "Autenticação administrativa requerida."}, ensure_ascii=False).encode("utf-8")
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="SIT Admin"')
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if self.should_disable_cache():
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]

        if not self.is_admin_authorized():
            self.reject_admin_auth()
            return

        if path == "/api":
            self.handle_api_get()
            return

        if path == "/admin/upload-participantes":
            self.send_json({"ok": True, "message": "Envie um POST multipart com o campo arquivo."})
            return

        super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]

        if not self.is_admin_authorized():
            self.reject_admin_auth()
            return

        if path == "/api":
            self.handle_api_post()
            return

        if path != "/admin/upload-participantes":
            self.send_error(404, "Rota não encontrada")
            return

        try:
            field = self.get_upload_field()
            summary = import_uploaded_file(field)
            self.send_json({"ok": True, **summary})
        except ValueError as exc:
            self.send_json({"ok": False, "error": str(exc)}, status=400)
        except sqlite3.Error as exc:
            self.send_json({"ok": False, "error": "Erro de gravação no banco SQLite: " + str(exc)}, status=500)
        except Exception as exc:
            self.send_json({"ok": False, "error": "Erro ao processar o upload: " + str(exc)}, status=500)

    def handle_api_get(self):
        query = urllib.parse.urlparse(self.path).query
        params = {key: values[-1] for key, values in urllib.parse.parse_qs(query).items()}
        try:
            payload = handle_api_action(params)
            self.send_json_or_jsonp(payload, params.get("callback"))
        except sqlite3.Error as exc:
            self.send_json_or_jsonp({"ok": False, "error": "Erro SQLite: " + str(exc)}, params.get("callback"), 500)
        except Exception as exc:
            self.send_json_or_jsonp({"ok": False, "error": str(exc)}, params.get("callback"), 500)

    def handle_api_post(self):
        content_length = int(self.headers.get("Content-Length", "0") or 0)
        raw_body = self.rfile.read(content_length) if content_length else b""
        params = {}

        if raw_body:
            try:
                payload = json.loads(raw_body.decode("utf-8"))
                params = {key: str(value) for key, value in payload.items()}
            except json.JSONDecodeError:
                params = {
                    key: values[-1]
                    for key, values in urllib.parse.parse_qs(raw_body.decode("utf-8")).items()
                }

        try:
            self.send_json(handle_api_action(params))
        except sqlite3.Error as exc:
            self.send_json({"ok": False, "error": "Erro SQLite: " + str(exc)}, status=500)
        except Exception as exc:
            self.send_json({"ok": False, "error": str(exc)}, status=500)

    def get_upload_field(self):
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            },
        )
        field = form["arquivo"] if "arquivo" in form else None

        if field is None or not field.filename:
            raise ValueError("Selecione um arquivo CSV ou XLSX para importar.")

        return field

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json_or_jsonp(self, payload, callback=None, status=200):
        if callback:
            safe_callback = re.sub(r"[^a-zA-Z0-9_.$]", "", callback)
            body = f"{safe_callback}({json.dumps(payload, ensure_ascii=False)});".encode("utf-8")
            content_type = "application/javascript; charset=utf-8"
        else:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            content_type = "application/json; charset=utf-8"

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    create_database()
    pause_printing_on_startup()
    server = ThreadingHTTPServer((HOST, PORT), AdminRequestHandler)
    display_host = "127.0.0.1" if HOST == "0.0.0.0" else HOST
    print(f"Servidor iniciado em http://{display_host}:{PORT}/admin.html")
    print(f"Banco SQLite: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        PORT = int(sys.argv[1])
    main()
