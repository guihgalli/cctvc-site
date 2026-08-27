"""Executa lotes SQL via stdin para uso com MCP execute_sql."""
from pathlib import Path

BATCHES = [
    "import_batch_01.sql",
    "import_batch_02.sql",
    "import_batch_03.sql",
    "import_batch_04.sql",
    "import_step2_dependentes_part1_nobegin.sql",
    "import_step2_dependentes_part2_nobegin.sql",
]

base = Path(__file__).resolve().parent
for name in BATCHES:
    path = base / name
    print(f"===FILE:{name}===SIZE:{path.stat().st_size}===")
    print(path.read_text(encoding="utf-8"), end="")
    print(f"\n===END:{name}===")
