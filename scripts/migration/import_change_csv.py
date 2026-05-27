#!/usr/bin/env python3
"""
J-INTAKE-MIGRATION-01: change過去発注CSV (prize_orders_all.csv) → prize_orders 移行。

リポジトリ既存パターン (scripts/import_excel/*) に倣い、本スクリプトは
**SQLを標準出力に生成**し、実行は Supabase MCP 経由で行う (ローカルにservice_role鍵無し/anonはRLSで弾かれるため)。

使い方:
  python3 scripts/migration/import_change_csv.py            # dry-run: 集計サマリのみ (DB非接触)
  python3 scripts/migration/import_change_csv.py --emit-sql  # INSERT SQL を stdout へ
                                                             # (dedup: NOT EXISTS で冪等)

dedup_scope:
  --dedup-scope=migration (default) : order_source='csv_migration' の既存とのみ重複排除 (再実行=0件、初回1230件)
  --dedup-scope=sgp                 : supplier_id='SGP' 横断で重複排除 (spec原文。既存sgp_apiとも突合)
"""
import csv
import sys
import argparse
from datetime import date

CSV_PATH = '/Users/dfx/clawops/archive/取込/output/prize_orders_all.csv'
SUPPLIER_ID = 'SGP'
ORDER_SOURCE = 'csv_migration'
SOURCE_FILE = 'prize_orders_all.csv'
MIN_COLS = 9  # フッター集計行(列数僅少)を除外

# 0-based 列インデックス (21列様式)
C = dict(seiri=0, cart=1, ship=2, ship_date=3, order_dt=4, orderer=5,
         dest=6, billed=7, product_code=8, name=9, unit_excl=10,
         pieces=11, qty=12, unit=13, sub_excl=14, total_incl=15,
         shipping=16, ship_status=17, delivery=18, confirm=19, category=20)


def to_int(v):
    s = (v or '').strip().replace(',', '')
    try:
        return int(float(s)) if s != '' else None
    except ValueError:
        return None


def to_num(v):
    s = (v or '').strip().replace(',', '')
    try:
        return float(s) if s != '' else None
    except ValueError:
        return None


def order_date_of(dt_raw):
    # "2025-03-25 17:30" → "2025-03-25"
    s = (dt_raw or '').strip()
    return s.split(' ')[0] if s else None


def status_of(ship_status):
    s = (ship_status or '').strip()
    return 'shipped' if ('発送完了' in s or '発送済' in s or '出荷完了' in s) else 'ordered'


def parse_rows():
    rows = []
    skipped_footer = 0
    with open(CSV_PATH, encoding='utf-8-sig', newline='') as fh:
        reader = csv.reader(fh)
        header = next(reader)
        for raw in reader:
            if len(raw) < MIN_COLS:
                skipped_footer += 1
                continue
            name = (raw[C['name']] or '').strip() if len(raw) > C['name'] else ''
            if not name:
                skipped_footer += 1
                continue
            qty = to_int(raw[C['qty']]) if len(raw) > C['qty'] else None
            sub_excl = to_num(raw[C['sub_excl']]) if len(raw) > C['sub_excl'] else None
            rows.append({
                'prize_name_raw': name,
                'supplier_id': SUPPLIER_ID,
                'order_source': ORDER_SOURCE,
                'source_file': SOURCE_FILE,
                'order_date': order_date_of(raw[C['order_dt']]),
                'case_count': qty,
                'pieces_per_case': to_int(raw[C['pieces']]),
                'unit_cost': to_num(raw[C['unit_excl']]),
                'case_cost': (sub_excl / qty) if (sub_excl is not None and qty) else None,
                'total_tax_included': to_num(raw[C['total_incl']]),
                'destination_raw': (raw[C['dest']] or '').strip(),
                'status': status_of(raw[C['ship_status']]),
                'notes': ' '.join(filter(None, [(raw[C['delivery']] or '').strip(), (raw[C['confirm']] or '').strip()])),
                'cart_id': (raw[C['cart']] or '').strip(),
                'product_code': (raw[C['product_code']] or '').strip(),
            })
    return rows, skipped_footer


def sql_escape(s):
    return "'" + str(s).replace("'", "''") + "'" if s is not None and s != '' else 'NULL'


def num_or_null(v):
    return str(v) if v is not None else 'NULL'


def emit_sql(rows, dedup_scope):
    today = date.today().isoformat()
    print('-- J-INTAKE-MIGRATION-01: change過去発注CSV → prize_orders')
    print(f'-- rows={len(rows)} dedup_scope={dedup_scope} generated={today}')
    print('BEGIN;')
    for r in rows:
        meta = ('{' + f'"cart_id":{sql_escape(r["cart_id"]).strip(chr(39))!r}'.replace("'", '"') + '}')
        # import_meta は jsonb_build_object で安全に組む
        if dedup_scope == 'sgp':
            dedup = (f"supplier_id='SGP' AND order_date={sql_escape(r['order_date'])} "
                     f"AND prize_name_raw={sql_escape(r['prize_name_raw'])} "
                     f"AND case_count={num_or_null(r['case_count'])}")
        else:
            dedup = (f"order_source='csv_migration' AND order_date={sql_escape(r['order_date'])} "
                     f"AND prize_name_raw={sql_escape(r['prize_name_raw'])} "
                     f"AND case_count={num_or_null(r['case_count'])}")
        print(
            "INSERT INTO prize_orders "
            "(order_id, prize_name_raw, supplier_id, order_source, source_file, order_date, "
            "case_count, pieces_per_case, unit_cost, case_cost, total_tax_included, destination, status, notes, import_meta, unplanned_flag) "
            "SELECT gen_random_uuid(), "
            f"{sql_escape(r['prize_name_raw'])}, '{SUPPLIER_ID}', '{ORDER_SOURCE}', '{SOURCE_FILE}', {sql_escape(r['order_date'])}, "
            f"{num_or_null(r['case_count'])}, {num_or_null(r['pieces_per_case'])}, {num_or_null(r['unit_cost'])}, "
            f"{num_or_null(r['case_cost'])}, {num_or_null(r['total_tax_included'])}, {sql_escape(r['destination_raw'])}, "
            f"{sql_escape(r['status'])}, {sql_escape(r['notes'])}, "
            f"jsonb_build_object('cart_id', {sql_escape(r['cart_id'])}, 'product_code', {sql_escape(r['product_code'])}, 'migration_date', '{today}'), "
            "false "
            f"WHERE NOT EXISTS (SELECT 1 FROM prize_orders WHERE {dedup});"
        )
    print('COMMIT;')


def dry_run(rows, skipped_footer):
    from collections import Counter
    statuses = Counter(r['status'] for r in rows)
    dests = Counter(r['destination_raw'] for r in rows)
    dates = sorted(r['order_date'] for r in rows if r['order_date'])
    print(f'=== dry-run summary ===')
    print(f'parsed rows (net):   {len(rows)}')
    print(f'skipped footer/empty: {skipped_footer}')
    print(f'order_date range:    {dates[0]} 〜 {dates[-1]}')
    print(f'status breakdown:    {dict(statuses)}')
    print(f'distinct 発送先(dest): {len(dests)}')
    for d, c in dests.most_common(15):
        print(f'   {c:5}  {d}')
    print('--- sample mapped rows ---')
    for r in rows[:3]:
        print('  ', {k: r[k] for k in ('order_date', 'prize_name_raw', 'case_count', 'pieces_per_case', 'unit_cost', 'status', 'destination_raw')})


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--emit-sql', action='store_true')
    ap.add_argument('--dedup-scope', choices=['migration', 'sgp'], default='migration')
    args = ap.parse_args()
    rows, skipped = parse_rows()
    if args.emit_sql:
        emit_sql(rows, args.dedup_scope)
    else:
        dry_run(rows, skipped)
