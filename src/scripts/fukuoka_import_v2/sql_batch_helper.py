#!/usr/bin/env python3
"""
SQL batch INSERT 生成ヘルパー。
ペイロード(JSON list of dict)を受けて、PostgreSQL INSERT SQL 文字列を生成する。
出力先: src/scripts/fukuoka_import_v2/insert_payload/sql/ に SQL ファイルとして書く。
"""
from __future__ import annotations

import json
from pathlib import Path

PAYLOAD_DIR = Path("src/scripts/fukuoka_import_v2/insert_payload")
SQL_DIR = PAYLOAD_DIR / "sql"
SQL_DIR.mkdir(parents=True, exist_ok=True)


def quote(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("'", "''")
    return "'" + s + "'"


def gen_insert(table: str, columns: list[str], rows: list[dict], conflict_key: str = None) -> str:
    vals = []
    for r in rows:
        parts = [quote(r.get(c)) for c in columns]
        vals.append("(" + ",".join(parts) + ")")
    sql = f"INSERT INTO {table} ({','.join(columns)}) VALUES " + ",\n".join(vals)
    if conflict_key:
        sql += f"\nON CONFLICT ({conflict_key}) DO NOTHING"
    sql += ";"
    return sql


def chunk(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def main():
    # --- machines ---
    machines = json.load(open(PAYLOAD_DIR / "machines.json", encoding="utf-8"))
    cols = ["machine_code", "store_code", "machine_name", "floor",
            "organization_id", "ownership_type", "is_active", "notes"]
    sql = gen_insert("public.machines", cols, machines, conflict_key="machine_code")
    (SQL_DIR / "01_machines.sql").write_text(sql, encoding="utf-8")
    print(f"machines: 1 file, {len(machines)} rows")

    # --- booths ---
    booths = json.load(open(PAYLOAD_DIR / "booths.json", encoding="utf-8"))
    cols = ["booth_code", "machine_code", "store_code", "booth_number",
            "is_active", "play_price"]
    sql = gen_insert("public.booths", cols, booths, conflict_key="booth_code")
    (SQL_DIR / "02_booths.sql").write_text(sql, encoding="utf-8")
    print(f"booths: 1 file, {len(booths)} rows")

    # --- prize_masters ---
    prizes = json.load(open(PAYLOAD_DIR / "prize_masters.json", encoding="utf-8"))
    cols = ["prize_id", "prize_name", "organization_id", "phase", "notes"]
    # 2 batchに分ける
    for i, batch in enumerate(chunk(prizes, 400), 1):
        sql = gen_insert("public.prize_masters", cols, batch, conflict_key="prize_id")
        (SQL_DIR / f"03_prize_masters_{i:02d}.sql").write_text(sql, encoding="utf-8")
    print(f"prize_masters: {(len(prizes) + 399) // 400} files, {len(prizes)} rows")

    # --- meter_readings ---
    meter = json.load(open(PAYLOAD_DIR / "meter_readings.json", encoding="utf-8"))
    cols = ["booth_id", "store_code", "machine_code", "booth_code",
            "full_booth_code", "patrol_date", "in_meter", "out_meter",
            "prize_restock_count", "prize_stock_count",
            "prize_name", "prize_cost", "note", "set_o",
            "source", "input_method", "organization_id", "created_by",
            "entry_type", "visit_index"]
    BATCH = 4500
    n_batches = 0
    for i, batch in enumerate(chunk(meter, BATCH), 1):
        sql = gen_insert("public.meter_readings", cols, batch)
        (SQL_DIR / f"04_meter_readings_{i:03d}.sql").write_text(sql, encoding="utf-8")
        n_batches += 1
    print(f"meter_readings: {n_batches} files, {len(meter)} rows ({BATCH}/batch)")


if __name__ == "__main__":
    main()
