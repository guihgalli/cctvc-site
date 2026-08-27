#!/usr/bin/env python3
"""Gera SQL de importação a partir de Relatorio_Associados_e_Dependentes.xlsx."""
from __future__ import annotations

import json
import random
import secrets
import sys
from datetime import date, datetime
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Instale openpyxl: pip install openpyxl", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[2]
XLSX = ROOT / "Relatorio_Associados_e_Dependentes.xlsx"
OUT_SQL = Path(__file__).resolve().parent / "import_socios_planilha.sql"
OUT_ADMIN = Path(__file__).resolve().parent / "import_admin_credentials.json"


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_date(value: date | None) -> str:
    if value is None:
        return "NULL"
    return sql_str(value.isoformat())


def sql_int(value: int | None) -> str:
    if value is None:
        return "NULL"
    return str(int(value))


def excel_date(value: object) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


def cpf_from_senha(senha: str) -> str:
    return (senha.zfill(6) + "00000")[:11]


def codigo_titular(codigo: str) -> str:
    return codigo[:3] + "0"


def load_rows() -> tuple[list[dict], list[dict], dict[int, dict]]:
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)

    titulares: list[dict] = []
    for row in wb["Titulares"].iter_rows(min_row=2, values_only=True):
        nome, matricula, user, senha = row[0], row[1], row[2], row[3]
        if not nome or not user:
            continue
        titulares.append(
            {
                "nome": str(nome).strip(),
                "matricula": int(matricula) if matricula is not None else None,
                "user": str(user).zfill(4),
                "senha": str(senha).zfill(6),
            }
        )

    titular_meta: dict[int, dict] = {}
    dependentes: list[dict] = []
    for row in wb["Dependentes"].iter_rows(min_row=2, values_only=True):
        if not row[6] or not row[7]:
            continue
        matricula = int(row[0]) if row[0] is not None else None
        if matricula is not None and matricula not in titular_meta:
            titular_meta[matricula] = {
                "categoria_clube": str(row[2]).strip() if row[2] else None,
                "data_nascimento": excel_date(row[3]),
                "data_admissao": excel_date(row[4]),
            }
        dependentes.append(
            {
                "matricula": matricula,
                "nome": str(row[6]).strip(),
                "user": str(row[7]).zfill(4),
                "senha": str(row[8]).zfill(6),
                "numero_dependente": int(row[5]) if row[5] is not None else None,
                "parentesco": str(row[9]).strip() if row[9] else None,
                "sexo": str(row[10]).strip().upper()[:1] if row[10] else None,
                "data_nascimento": excel_date(row[11]),
            }
        )

    wb.close()
    return titulares, dependentes, titular_meta


def pick_admin_code(used: set[str]) -> str:
    rng = random.SystemRandom()
    for _ in range(10_000):
        code = f"{rng.randint(0, 9999):04d}"
        if code not in used:
            return code
    raise RuntimeError("Não foi possível gerar código admin livre")


def load_admin_credentials(used: set[str]) -> tuple[str, str]:
    if OUT_ADMIN.exists():
        try:
            data = json.loads(OUT_ADMIN.read_text(encoding="utf-8"))
            code = str(data.get("codigo_usuario", "")).zfill(4)
            senha = str(data.get("senha", "")).zfill(6)
            if code and senha and code not in used:
                return code, senha
        except (json.JSONDecodeError, OSError):
            pass
    return pick_admin_code(used), f"{secrets.randbelow(1_000_000):06d}"


def main() -> None:
    titulares, dependentes, titular_meta = load_rows()
    used_codes = {t["user"] for t in titulares} | {d["user"] for d in dependentes}

    admin_code, admin_senha = load_admin_credentials(used_codes)
    admin_cpf = cpf_from_senha(admin_senha)
    admin_nome = "Administrador CCTVC"

    mat_to_user: dict[int, str] = {}
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    for row in wb["Titulares"].iter_rows(min_row=2, values_only=True):
        if row[0] and row[1] is not None and row[2]:
            mat_to_user[int(row[1])] = str(row[2]).zfill(4)
    wb.close()

    insert_cols = (
        "codigo_usuario, cpf, nome, email, telefone, perfil, tipo_socio, categoria_socio, "
        "titular_id, matricula, categoria_clube, data_nascimento, data_admissao, "
        "parentesco, sexo, numero_dependente, senha_hash"
    )

    lines: list[str] = [
        "-- Importação: Relatorio_Associados_e_Dependentes.xlsx (todos os campos)",
        "SET search_path = public, extensions;",
        "BEGIN;",
        "",
        "DELETE FROM sessoes;",
        "DELETE FROM reserva_participantes;",
        "DELETE FROM reservas;",
        "DELETE FROM liberacoes_quadra_locacao;",
        "DELETE FROM usuarios;",
        "",
        f"INSERT INTO usuarios ({insert_cols})",
        f"VALUES ({sql_str(admin_code)}, {sql_str(admin_cpf)}, {sql_str(admin_nome)}, '', '', 'admin', 'socio', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, crypt({sql_str(admin_senha)}, gen_salt('bf')));",
        "",
    ]

    for t in titulares:
        meta = titular_meta.get(t["matricula"] or -1, {})
        cpf = cpf_from_senha(t["senha"])
        cat = meta.get("categoria_clube")
        lines.append(
            f"INSERT INTO usuarios ({insert_cols})"
            f" VALUES ({sql_str(t['user'])}, {sql_str(cpf)}, {sql_str(t['nome'])}, '', '', 'usuario', 'socio', 'titular', NULL,"
            f" {sql_int(t['matricula'])}, {sql_str(cat) if cat else 'NULL'}, {sql_date(meta.get('data_nascimento'))}, {sql_date(meta.get('data_admissao'))},"
            f" NULL, NULL, NULL, crypt({sql_str(t['senha'])}, gen_salt('bf')));"
        )

    lines.append("")

    for d in dependentes:
        cpf = cpf_from_senha(d["senha"])
        titular_code = mat_to_user.get(d["matricula"] or -1) or codigo_titular(d["user"])
        parentesco = d.get("parentesco")
        sexo = d.get("sexo")
        lines.append(
            f"INSERT INTO usuarios ({insert_cols})"
            f" VALUES ({sql_str(d['user'])}, {sql_str(cpf)}, {sql_str(d['nome'])}, '', '', 'usuario', 'socio', 'dependente',"
            f" (SELECT id FROM usuarios WHERE codigo_usuario = {sql_str(titular_code)} LIMIT 1),"
            f" {sql_int(d['matricula'])}, NULL, {sql_date(d.get('data_nascimento'))}, NULL,"
            f" {sql_str(parentesco) if parentesco else 'NULL'}, {sql_str(sexo) if sexo else 'NULL'}, {sql_int(d.get('numero_dependente'))},"
            f" crypt({sql_str(d['senha'])}, gen_salt('bf')));"
        )

    lines.extend(["", "COMMIT;", ""])

    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    OUT_ADMIN.write_text(
        json.dumps(
            {
                "codigo_usuario": admin_code,
                "senha": admin_senha,
                "nome": admin_nome,
                "titulares": len(titulares),
                "dependentes": len(dependentes),
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print(f"Titulares: {len(titulares)}")
    print(f"Dependentes: {len(dependentes)}")
    print(f"Admin: {admin_code} / {admin_senha}")
    print(f"SQL: {OUT_SQL}")


if __name__ == "__main__":
    main()
