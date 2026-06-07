#!/usr/bin/env python3
"""
prize_masters の SQL ファイルを 50 行ずつのチャンクに分割。

入力: insert_payload/sql/03_prize_masters_01.sql (400 行) + 02.sql (245 行)
出力: insert_payload/chunks/chunk_NN.sql (各 50 行、計 13 chunk)
"""
from __future__ import annotations

import re
from pathlib import Path

SRC = Path("src/scripts/fukuoka_import_v2/insert_payload/sql")
OUT = Path("src/scripts/fukuoka_import_v2/insert_payload/chunks")
OUT.mkdir(parents=True, exist_ok=True)

CHUNK_ROWS = 50


def parse_sql(path: Path) -> tuple[str, list[str], str]:
    text = path.read_text(encoding="utf-8")
    # header = INSERT INTO ... VALUES
    m = re.match(r"^(INSERT INTO[^()]+\([^)]+\)\s*VALUES\s*)(.*?)(\s*ON CONFLICT.*?;)\s*$", text, re.DOTALL)
    if not m:
        raise ValueError(f"パースできず: {path}")
    header = m.group(1).strip() + "\n"
    body = m.group(2).strip()
    footer = m.group(3).strip()
    # body は (...),\n(...),\n(...) 形式 → 個別行に分解
    # SQL VALUES の各レコードは外側 1 段の括弧でくくられている前提
    rows = []
    depth = 0
    start = None
    for i, ch in enumerate(body):
        if ch == "(":
            if depth == 0:
                start = i
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                rows.append(body[start:i+1])
                start = None
    if not rows:
        raise ValueError(f"行抽出失敗: {path}")
    return header, rows, footer


def main():
    file_01 = SRC / "03_prize_masters_01.sql"
    file_02 = SRC / "03_prize_masters_02.sql"

    chunks = []  # list of (chunk_index, sql_text)
    for src_path in (file_01, file_02):
        header, rows, footer = parse_sql(src_path)
        # 50 行ずつ
        for i in range(0, len(rows), CHUNK_ROWS):
            sub = rows[i:i + CHUNK_ROWS]
            body = ",\n".join(sub)
            chunk_sql = header + body + "\n" + footer
            chunks.append(chunk_sql)

    # 通し番号で保存
    for i, sql in enumerate(chunks, 1):
        out_path = OUT / f"chunk_{i:02d}.sql"
        out_path.write_text(sql, encoding="utf-8")

    print(f"chunks 生成完了: {len(chunks)} 個 → {OUT}/")
    for i, sql in enumerate(chunks, 1):
        n_rows = sql.count("(") - sql.count(",\n('FUKUOKA") - 0  # おおよそ
        # 単純に元 list の長さで計算
        print(f"  chunk_{i:02d}.sql: {len(sql):>6} bytes")


if __name__ == "__main__":
    main()
