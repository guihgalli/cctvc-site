from pathlib import Path

sql = Path("supabase/scripts/import_socios_planilha.sql").read_text(encoding="utf-8")
lines = sql.splitlines()
dep_start = next(
    i
    for i, line in enumerate(lines)
    if "categoria_socio, titular_id" in line and "'dependente'" in line
)
commit_i = next(i for i, line in enumerate(lines) if line.strip() == "COMMIT;")
base = Path("supabase/scripts")
step1 = lines[:dep_start] + ["COMMIT;"]
step2 = [
    "SET search_path = public, extensions;",
    "BEGIN;",
    *lines[dep_start:commit_i],
    "COMMIT;",
]
(base / "import_step1_cleanup_admin_titulares.sql").write_text("\n".join(step1), encoding="utf-8")
(base / "import_step2_dependentes.sql").write_text("\n".join(step2), encoding="utf-8")
print("step1 bytes", (base / "import_step1_cleanup_admin_titulares.sql").stat().st_size)
print("step2 bytes", (base / "import_step2_dependentes.sql").stat().st_size)
