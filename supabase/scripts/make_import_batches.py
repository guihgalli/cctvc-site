from pathlib import Path

def collect_inserts(lines: list[str]) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    for line in lines:
        if line.startswith("INSERT"):
            if current:
                statements.append("\n".join(current))
            current = [line]
        elif current:
            current.append(line)
            if line.rstrip().endswith(");"):
                statements.append("\n".join(current))
                current = []
    if current:
        statements.append("\n".join(current))
    return statements


base = Path("supabase/scripts")
step1 = (base / "import_step1_cleanup_admin_titulares.sql").read_text(encoding="utf-8").splitlines()
inserts = collect_inserts(step1)
header = ["SET search_path = public, extensions;"]
batch_size = 40
for i in range(0, len(inserts), batch_size):
    chunk = inserts[i : i + batch_size]
    out = base / f"import_batch_{i // batch_size + 1:02d}.sql"
    out.write_text("\n".join(header + chunk) + "\n", encoding="utf-8")

for name in ["import_step2_dependentes_part1.sql", "import_step2_dependentes_part2.sql"]:
    part = (base / name).read_text(encoding="utf-8").splitlines()
    part_inserts = collect_inserts(part)
    out = base / name.replace(".sql", "_nobegin.sql")
    out.write_text("\n".join(header + part_inserts) + "\n", encoding="utf-8")
    print(out.name, len(part_inserts))
