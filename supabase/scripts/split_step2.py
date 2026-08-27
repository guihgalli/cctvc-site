from pathlib import Path

step2 = Path("supabase/scripts/import_step2_dependentes.sql").read_text(encoding="utf-8").splitlines()
inserts = [l for l in step2 if l.startswith("INSERT")]
header = ["SET search_path = public, extensions;", "BEGIN;"]
footer = ["COMMIT;"]
mid = len(inserts) // 2
parts = [inserts[:mid], inserts[mid:]]
base = Path("supabase/scripts")
for i, part in enumerate(parts, 1):
    content = "\n".join(header + part + footer) + "\n"
    out = base / f"import_step2_dependentes_part{i}.sql"
    out.write_text(content, encoding="utf-8")
    print(out.name, out.stat().st_size, "inserts", len(part))
