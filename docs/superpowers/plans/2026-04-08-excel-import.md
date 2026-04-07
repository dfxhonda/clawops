# Excel Data Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse 4 Excel files (ドンキ日売速報, 福重売上表, 棚卸リスト, レンタル売上表) and import into Supabase (stores, machines, booths, meter_readings, prize_stocks, billing_contracts, billing_events).

**Architecture:** Python scripts parse Excel → compare against existing DB state → output SQL INSERT statements → execute via Supabase MCP `execute_sql`. Source-tagged with `updated_by='excel_import_2026-04'`. Each phase can be run and verified independently.

**Tech Stack:** Python 3, openpyxl, difflib, uuid, Supabase MCP

---

## File Structure

```
scripts/import_excel/
  config.py            - store mappings, Excel paths, constants
  helpers.py           - SQL escaping, ID gen, name normalization, fuzzy match
  phase1_masters.py    - parse Excel → SQL for stores/machines/booths
  phase2_readings.py   - parse ドンキ日売速報 + 福重売上表 → meter_readings SQL
  phase3_zaiko.py      - parse 棚卸リスト → prize_stocks SQL
  phase4_rental.py     - parse レンタル → billing_contracts + billing_events SQL
  run.py               - orchestrate all phases, print SQL to stdout
  tests/
    test_helpers.py
    test_phase2.py
```

**Existing DB state to preserve:**
- machines: KOS01-M01~M08, KKY01-M01~M02, MMNON8GAP, MNK01-M01~M02
- booths: KOS01 (M02~M08 have 2-4 booths each), KKY01-M01/M02, MNK01-M01/M02
- Machine name matching uses `normalize_machine_name()` (NFKC + strip parentheticals)

---

## Task 1: config.py + helpers.py

**Files:**
- Create: `scripts/import_excel/config.py`
- Create: `scripts/import_excel/helpers.py`

- [ ] **Step 1: Create config.py**

```python
# scripts/import_excel/config.py
import os

EXCEL_DIR = '/Users/dfx/clawops/docs/lists'
DONKI_FILE  = f'{EXCEL_DIR}/ドンキ日売速報長崎鹿児島熊本 (2) (1).xlsx'
FUKUSHIGE_FILE = f'{EXCEL_DIR}/★福重　クレーン売上表.xlsx'
ZAIKO_FILE  = f'{EXCEL_DIR}/景品棚卸リスト　3期 (1).xlsx'
RENTAL_FILE = f'{EXCEL_DIR}/★レンタル売上表 3期.xlsx'

IMPORT_TAG = 'excel_import_2026-04'
DEFAULT_OPERATOR_ID = 'CHG'

# Excel sheet name → store_code (existing DB stores)
STORE_MAP = {
    '鹿屋': 'KNY01', '都城': 'MYJ01', '霧島': 'KRH01',
    '宇宿': 'KGU01', '川内': 'STS01', '中央': 'KGC01',
    '天文館': 'TBK01',  # new store
    '合志': 'KOS01', '菊陽': 'KKY01', '南熊本': 'MNK01',
    '福重': 'FKS01', '福重店': 'FKS01',
    '那珂川': 'NKG01', '飯塚': 'IIZ01', '飯塚店': 'IIZ01',
    '鞍手': 'KUT01', '宗像': 'MKM01', '唐津': 'KRT01',
    '佐賀': 'SAG01', '黒崎': 'KRS01', '八女': 'YME01',
    # rental clients not yet in stores table
    '長浜': 'NGH01', '大牟田': 'OMT01', '遠賀': 'ONK01',
    '久留米': 'KRM01',
}

# Stores to INSERT (store_code, store_name, store_type)
NEW_STORES = [
    ('TBK01', 'ドン・キホーテ 天文館店',   'donki'),
    ('NGH01', '長浜（レンタル先）',         'external'),
    ('OMT01', '大牟田（レンタル先）',       'external'),
    ('ONK01', '遠賀（レンタル先）',         'external'),
    ('KRM01', '久留米（レンタル先）',       'external'),
]

DONKI_SHEETS = ['鹿屋', '都城', '霧島', '宇宿', '川内', '中央', '天文館', 'クレーン熊本']

# Existing machine max M numbers per store (for generating new codes)
# These are determined by querying DB at runtime in phase1_masters.py
# Pre-known from DB inspection:
EXISTING_MACHINE_MAX = {
    'KOS01': 8,   # M01~M08 exist
    'KKY01': 2,   # M01~M02 exist (MMNON8GAP ignored as non-standard)
    'MNK01': 2,   # M01~M02 exist
}
```

- [ ] **Step 2: Create helpers.py**

```python
# scripts/import_excel/helpers.py
import uuid
import unicodedata
import re
import difflib
from datetime import date, datetime


def new_id() -> str:
    return str(uuid.uuid4()).replace('-', '')[:16].upper()


def sq(v) -> str:
    """Escape a value for SQL single-quote string."""
    if v is None:
        return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"


def sql_date(d) -> str:
    if d is None:
        return 'NULL'
    if isinstance(d, datetime):
        d = d.date()
    return sq(d.strftime('%Y-%m-%d'))


def sql_ts(d) -> str:
    if d is None:
        return 'NULL'
    if isinstance(d, date) and not isinstance(d, datetime):
        return sq(f'{d.strftime("%Y-%m-%d")} 00:00:00+09')
    return sq(d.strftime('%Y-%m-%d %H:%M:%S+09'))


def normalize(name: str) -> str:
    """Normalize machine/prize name: NFKC + strip parentheticals + strip."""
    name = unicodedata.normalize('NFKC', str(name))
    name = re.sub(r'[（(][^）)]*[）)]', '', name)
    return name.strip()


def fuzzy_match(name: str, candidates: list[str], cutoff=0.6) -> str | None:
    """Return best matching candidate for name, or None if below cutoff."""
    norm_name = normalize(name)
    norm_candidates = [normalize(c) for c in candidates]
    matches = difflib.get_close_matches(norm_name, norm_candidates, n=1, cutoff=cutoff)
    if matches:
        idx = norm_candidates.index(matches[0])
        return candidates[idx]
    return None


def next_machine_code(store_code: str, existing_max: dict) -> str:
    n = existing_max.get(store_code, 0) + 1
    existing_max[store_code] = n
    return f'{store_code}-M{n:02d}'


def booth_code(machine_code: str, booth_num: int) -> str:
    return f'{machine_code}-B{booth_num:02d}'


def to_date_or_none(v):
    """Convert Excel cell value to date, or return None."""
    from datetime import datetime, date
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)) and 40000 < v < 60000:
        return date.fromordinal(date(1899, 12, 30).toordinal() + int(v))
    return None
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dfx/clawops
git add scripts/import_excel/config.py scripts/import_excel/helpers.py
git commit -m "feat: excel import config and helpers"
```

---

## Task 2: tests/test_helpers.py

**Files:**
- Create: `scripts/import_excel/tests/__init__.py`
- Create: `scripts/import_excel/tests/test_helpers.py`

- [ ] **Step 1: Write tests**

```python
# scripts/import_excel/tests/test_helpers.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from helpers import normalize, fuzzy_match, next_machine_code, booth_code, sq


def test_normalize_fullwidth():
    assert normalize('BUZZ＃1（BUZZクレーン）') == 'BUZZ#1'


def test_normalize_halfwidth():
    assert normalize('セサミ＃１') == 'セサミ#1'


def test_fuzzy_match_exact():
    candidates = ['BUZZ#1', 'BUZZ#2', 'BUZZミニ']
    assert fuzzy_match('BUZZ＃1（BUZZクレーン）', candidates) == 'BUZZ#1'


def test_fuzzy_match_no_match():
    candidates = ['BUZZ#1', 'BUZZ#2']
    assert fuzzy_match('ガチャコロ', candidates) is None


def test_next_machine_code_new_store():
    state = {}
    assert next_machine_code('FKS01', state) == 'FKS01-M01'
    assert next_machine_code('FKS01', state) == 'FKS01-M02'


def test_next_machine_code_existing_store():
    from config import EXISTING_MACHINE_MAX
    state = dict(EXISTING_MACHINE_MAX)
    assert next_machine_code('KOS01', state) == 'KOS01-M09'


def test_booth_code():
    assert booth_code('KNY01-M01', 3) == 'KNY01-M01-B03'


def test_sq_escapes_quotes():
    assert sq("it's") == "'it''s'"


def test_sq_none():
    assert sq(None) == 'NULL'
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/dfx/clawops
python -m pytest scripts/import_excel/tests/test_helpers.py -v
```

Expected: 8 passed

- [ ] **Step 3: Commit**

```bash
git add scripts/import_excel/tests/
git commit -m "test: excel import helpers unit tests"
```

---

## Task 3: phase1_masters.py (stores + machines + booths SQL)

**Files:**
- Create: `scripts/import_excel/phase1_masters.py`

This script extracts unique (store_code, machine_name, booth_num) tuples from both ドンキ日売速報 and 福重売上表, compares against existing DB, and outputs INSERT SQL.

- [ ] **Step 1: Write phase1_masters.py**

```python
# scripts/import_excel/phase1_masters.py
"""
Generates SQL for:
  1. New stores (天文館 + rental clients)
  2. New machines (those not already in DB by normalized name match)
  3. New booths  (for new machines; existing machines' booths already present)

Usage: python phase1_masters.py
Outputs SQL to stdout. Execute via Supabase MCP.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import openpyxl
from datetime import datetime
from config import (DONKI_FILE, FUKUSHIGE_FILE, STORE_MAP, DONKI_SHEETS,
                    NEW_STORES, DEFAULT_OPERATOR_ID, IMPORT_TAG,
                    EXISTING_MACHINE_MAX)
from helpers import normalize, next_machine_code, booth_code, sq, sql_date, new_id

# --- known existing machines: (store_code, normalized_name) -> machine_code ---
EXISTING_MACHINES = {
    ('KOS01', 'BUZZ#1'):   'KOS01-M02',
    ('KOS01', 'BUZZ#2'):   'KOS01-M03',
    ('KOS01', 'セサミ#3'): 'KOS01-M04',
    ('KOS01', 'セサミ#4'): 'KOS01-M05',
    ('KOS01', 'セサミ#1'): 'KOS01-M06',
    ('KOS01', 'セサミ#2'): 'KOS01-M07',
    ('KKY01', 'BUZZスリム'): 'KKY01-M01',
    ('KKY01', 'BUZZ#1'):   'KKY01-M02',
    ('MNK01', 'BUZZ#1'):   'MNK01-M01',
    ('MNK01', 'BUZZ#2'):   'MNK01-M02',
}

# existing booth counts per machine_code (from DB inspection)
EXISTING_BOOTHS = {
    'KOS01-M02': 4, 'KOS01-M03': 4,
    'KOS01-M04': 2, 'KOS01-M05': 2, 'KOS01-M06': 2, 'KOS01-M07': 2,
    'KKY01-M01': 2, 'KKY01-M02': 4,
    'MNK01-M01': 4, 'MNK01-M02': 4,
}


def parse_donki_machines():
    """
    Returns: list of (store_code, machine_name_raw, booth_num)
    One entry per machine/booth block in the Excel.
    """
    wb = openpyxl.load_workbook(DONKI_FILE, data_only=True)
    results = []
    for sheet_name in DONKI_SHEETS:
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        i = 1
        while i < len(rows):
            row = rows[i]
            if len(row) >= 2 and row[1] == '100円' and row[0] and str(row[0]).strip():
                store_name = str(row[0]).strip()
                machine_name = None
                booth_num = 1
                if i + 1 < len(rows) and rows[i+1][0]:
                    machine_name = str(rows[i+1][0]).strip()
                if i + 2 < len(rows) and rows[i+2][0] is not None:
                    try:
                        booth_num = int(rows[i+2][0])
                    except (ValueError, TypeError):
                        booth_num = 1
                store_code = STORE_MAP.get(store_name)
                if store_code and machine_name:
                    results.append((store_code, machine_name, booth_num))
                i += 12
            else:
                i += 1
    return results


def parse_fukushige_machines():
    """Returns: list of (store_code, machine_name_raw, 1) - 1 booth per machine."""
    wb = openpyxl.load_workbook(FUKUSHIGE_FILE, data_only=True)
    ws = wb['福重']
    row1 = list(ws.iter_rows(min_row=1, max_row=1, values_only=True))[0]
    results = []
    for v in row1:
        if v and '福重' in str(v):
            # strip '福重' prefix to get machine name
            name = str(v).strip()
            machine_name = name.replace('福重', '').strip() if name.startswith('福重') else name
            results.append(('FKS01', machine_name, 1))
    return results


def build_machine_registry(tuples):
    """
    Given list of (store_code, machine_name_raw, booth_num),
    returns:
      new_machines: list of (machine_code, store_code, machine_name_raw)
      new_booths:   list of (booth_code, machine_code, store_code, booth_num)
    Uses EXISTING_MACHINES dict to avoid duplicates.
    """
    m_state = dict(EXISTING_MACHINE_MAX)  # copy to track M number per store
    # track what we've already decided in this run
    decided = {}  # (store_code, norm_name) -> machine_code

    new_machines = []
    new_booths = []

    for store_code, machine_name_raw, booth_num in tuples:
        norm = normalize(machine_name_raw)
        key = (store_code, norm)

        # Already in DB?
        if key in EXISTING_MACHINES:
            mc = EXISTING_MACHINES[key]
            # Check if booth exists
            existing_booth_count = EXISTING_BOOTHS.get(mc, 0)
            if booth_num > existing_booth_count:
                bc = booth_code(mc, booth_num)
                new_booths.append((bc, mc, store_code, booth_num))
            continue

        # Already decided in this run?
        if key in decided:
            mc = decided[key]
        else:
            mc = next_machine_code(store_code, m_state)
            decided[key] = mc
            new_machines.append((mc, store_code, machine_name_raw))

        bc = booth_code(mc, booth_num)
        new_booths.append((bc, mc, store_code, booth_num))

    return new_machines, new_booths


def generate_stores_sql():
    lines = ['-- ===== NEW STORES =====']
    for (code, name, stype) in NEW_STORES:
        lines.append(
            f"INSERT INTO stores (store_code, store_name, store_name_official, store_type, "
            f"is_active, created_at, updated_at, updated_by) VALUES "
            f"({sq(code)}, {sq(name)}, {sq(name)}, {sq(stype)}, "
            f"TRUE, NOW(), NOW(), {sq(IMPORT_TAG)}) "
            f"ON CONFLICT (store_code) DO NOTHING;"
        )
    return '\n'.join(lines)


def generate_machines_sql(new_machines):
    if not new_machines:
        return '-- No new machines'
    lines = ['-- ===== NEW MACHINES =====']
    for (mc, store_code, machine_name) in new_machines:
        lines.append(
            f"INSERT INTO machines (machine_code, store_code, machine_name, play_price, "
            f"is_active, operator_id, created_at, updated_at, updated_by) VALUES "
            f"({sq(mc)}, {sq(store_code)}, {sq(machine_name)}, 100, "
            f"TRUE, {sq(DEFAULT_OPERATOR_ID)}, NOW(), NOW(), {sq(IMPORT_TAG)}) "
            f"ON CONFLICT (machine_code) DO NOTHING;"
        )
    return '\n'.join(lines)


def generate_booths_sql(new_booths):
    if not new_booths:
        return '-- No new booths'
    lines = ['-- ===== NEW BOOTHS =====']
    for (bc, mc, store_code, booth_num) in new_booths:
        lines.append(
            f"INSERT INTO booths (booth_code, machine_code, store_code, booth_number, "
            f"is_active, play_price, created_at, updated_at, updated_by) VALUES "
            f"({sq(bc)}, {sq(mc)}, {sq(store_code)}, {booth_num}, "
            f"TRUE, 100, NOW(), NOW(), {sq(IMPORT_TAG)}) "
            f"ON CONFLICT (booth_code) DO NOTHING;"
        )
    return '\n'.join(lines)


if __name__ == '__main__':
    tuples = parse_donki_machines() + parse_fukushige_machines()
    new_machines, new_booths = build_machine_registry(tuples)
    print(generate_stores_sql())
    print()
    print(generate_machines_sql(new_machines))
    print()
    print(generate_booths_sql(new_booths))
    print(f'\n-- Summary: {len(NEW_STORES)} stores, {len(new_machines)} machines, {len(new_booths)} booths')
```

- [ ] **Step 2: Run dry-run to verify output**

```bash
cd /Users/dfx/clawops
python scripts/import_excel/phase1_masters.py 2>&1 | head -80
```

Expected: SQL INSERT statements for ~5 stores, ~100+ machines, ~200+ booths. No Python errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/import_excel/phase1_masters.py
git commit -m "feat: phase1 - stores/machines/booths SQL generation"
```

---

## Task 4: phase2_readings.py (meter_readings SQL)

**Files:**
- Create: `scripts/import_excel/phase2_readings.py`
- Create: `scripts/import_excel/tests/test_phase2.py`

Reading strategy: create one meter_reading per machine/booth per collection date.
A "collection date" = date column where the 100円 cumulative value changed from the previous column.

- [ ] **Step 1: Write tests/test_phase2.py**

```python
# scripts/import_excel/tests/test_phase2.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from datetime import date
from phase2_readings import extract_readings_from_block


def test_extract_readings_detects_changes():
    dates = [(2, date(2026, 3, 19)), (3, date(2026, 3, 20)), (4, date(2026, 3, 22))]
    in_vals  = [None, None, 4201, 4201, 4281]   # index 2,3,4
    out_vals = [None, None, 292,  292,  296]
    readings = extract_readings_from_block(in_vals, out_vals, dates)
    # First date always included; 3/20 skipped (same); 3/22 included (changed)
    assert len(readings) == 2
    assert readings[0] == {'date': date(2026, 3, 19), 'in_meter': 4201, 'out_meter': 292}
    assert readings[1] == {'date': date(2026, 3, 22), 'in_meter': 4281, 'out_meter': 296}


def test_extract_readings_all_same():
    dates = [(2, date(2026, 3, 19)), (3, date(2026, 3, 20))]
    in_vals  = [None, None, 5000, 5000]
    out_vals = [None, None, 100,  100]
    readings = extract_readings_from_block(in_vals, out_vals, dates)
    # Only first date
    assert len(readings) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/dfx/clawops
python -m pytest scripts/import_excel/tests/test_phase2.py -v 2>&1 | tail -5
```

Expected: ImportError (phase2_readings not yet created)

- [ ] **Step 3: Write phase2_readings.py**

```python
# scripts/import_excel/phase2_readings.py
"""
Parses ドンキ日売速報 + 福重売上表 and generates meter_readings INSERT SQL.

Reading model:
  - One reading per booth per collection date (= date where meter value changed)
  - full_booth_code = {machine_code}-B{N:02d}
  - in_meter = 100円 cumulative count
  - out_meter = プライズ cumulative count
  - source = 'excel_import'
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import openpyxl
from datetime import datetime, date as date_class
from config import DONKI_FILE, FUKUSHIGE_FILE, STORE_MAP, DONKI_SHEETS, IMPORT_TAG
from helpers import normalize, new_id, sq, sql_ts
from phase1_masters import (
    parse_donki_machines, parse_fukushige_machines,
    build_machine_registry, EXISTING_MACHINES, EXISTING_MACHINE_MAX
)


def to_date(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date_class):
        return v
    if isinstance(v, (int, float)) and 40000 < v < 60000:
        return date_class.fromordinal(
            date_class(1899, 12, 30).toordinal() + int(v))
    return None


def extract_readings_from_block(in_vals, out_vals, dates):
    """
    in_vals/out_vals: list indexed by column number.
    dates: list of (col_idx, date).
    Returns list of {'date': date, 'in_meter': int, 'out_meter': int}.
    Only includes first date and dates where in_meter changed.
    """
    readings = []
    prev_in = None
    for col_idx, dt in dates:
        in_v = in_vals[col_idx] if col_idx < len(in_vals) else None
        out_v = out_vals[col_idx] if col_idx < len(out_vals) else None
        if not isinstance(in_v, (int, float)):
            continue
        in_v = int(in_v)
        out_v = int(out_v) if isinstance(out_v, (int, float)) else 0
        if prev_in is None or in_v != prev_in:
            readings.append({'date': dt, 'in_meter': in_v, 'out_meter': out_v})
            prev_in = in_v
    return readings


def parse_donki_readings(machine_registry):
    """
    machine_registry: dict (store_code, norm_name) -> machine_code
    Returns list of reading records with full_booth_code.
    """
    wb = openpyxl.load_workbook(DONKI_FILE, data_only=True)
    all_readings = []

    for sheet_name in DONKI_SHEETS:
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))

        # Extract date columns from row 0
        dates = []
        for col_i, v in enumerate(rows[0]):
            d = to_date(v)
            if d and col_i >= 2:
                dates.append((col_i, d))

        i = 1
        while i < len(rows):
            row = rows[i]
            if len(row) >= 2 and row[1] == '100円' and row[0] and str(row[0]).strip():
                store_name = str(row[0]).strip()
                store_code = STORE_MAP.get(store_name)
                machine_name_raw = str(rows[i+1][0]).strip() if i+1 < len(rows) and rows[i+1][0] else None
                booth_num = 1
                if i+2 < len(rows) and rows[i+2][0] is not None:
                    try:
                        booth_num = int(rows[i+2][0])
                    except (ValueError, TypeError):
                        booth_num = 1

                if store_code and machine_name_raw:
                    norm = normalize(machine_name_raw)
                    mc = machine_registry.get((store_code, norm))
                    if mc:
                        bc = f'{mc}-B{booth_num:02d}'
                        in_vals = list(row)
                        out_vals = list(rows[i+1]) if i+1 < len(rows) else []
                        for r in extract_readings_from_block(in_vals, out_vals, dates):
                            all_readings.append({
                                'full_booth_code': bc,
                                'read_time': r['date'],
                                'in_meter': r['in_meter'],
                                'out_meter': r['out_meter'],
                            })
                i += 12
            else:
                i += 1

    return all_readings


def parse_fukushige_readings(machine_registry):
    """Parse 福重売上表 column-based format."""
    wb = openpyxl.load_workbook(FUKUSHIGE_FILE, data_only=True)
    ws = wb['福重']
    rows = list(ws.iter_rows(values_only=True))

    # Row 0: machine name positions
    # Row 1: column headers (100円, 差, プライズ, ...)
    # Row 2+: data rows; col 0 = date, col 1 = store total

    machine_cols = []  # (start_col, machine_name_raw)
    for col_i, v in enumerate(rows[0]):
        if v and '福重' in str(v):
            name = str(v).replace('福重', '').strip()
            machine_cols.append((col_i, name))

    # Per-machine: col+0=100円, col+2=プライズ (0-indexed from machine start)
    all_readings = []
    for start_col, machine_name_raw in machine_cols:
        norm = normalize(machine_name_raw)
        mc = machine_registry.get(('FKS01', norm))
        if not mc:
            continue
        bc = f'{mc}-B01'

        in_vals_per_row = []
        out_vals_per_row = []
        dates = []

        for row in rows[2:]:
            if not row[0]:
                continue
            dt = to_date(row[0])
            if not dt:
                continue
            in_v = row[start_col] if start_col < len(row) else None
            out_v = row[start_col + 2] if start_col + 2 < len(row) else None
            if isinstance(in_v, (int, float)):
                in_vals_per_row.append((dt, int(in_v), int(out_v) if isinstance(out_v, (int, float)) else 0))

        prev_in = None
        for dt, in_v, out_v in in_vals_per_row:
            if prev_in is None or in_v != prev_in:
                all_readings.append({
                    'full_booth_code': bc,
                    'read_time': dt,
                    'in_meter': in_v,
                    'out_meter': out_v,
                })
                prev_in = in_v

    return all_readings


def generate_readings_sql(readings):
    if not readings:
        return '-- No readings'
    lines = ['-- ===== METER READINGS =====']
    for r in readings:
        rid = new_id()
        lines.append(
            f"INSERT INTO meter_readings "
            f"(reading_id, full_booth_code, booth_id, read_time, in_meter, out_meter, source, created_at, created_by) "
            f"VALUES ({sq(rid)}, {sq(r['full_booth_code'])}, {sq(r['full_booth_code'])}, "
            f"{sql_ts(r['read_time'])}, {r['in_meter']}, {r['out_meter']}, "
            f"{sq('excel_import')}, NOW(), {sq(IMPORT_TAG)}) "
            f"ON CONFLICT DO NOTHING;"
        )
    return '\n'.join(lines)


def build_full_machine_registry():
    """Build (store_code, norm_name) -> machine_code registry including new machines."""
    tuples = parse_donki_machines() + parse_fukushige_machines()
    new_machines, _ = build_machine_registry(tuples)
    registry = dict(EXISTING_MACHINES)
    # Add newly decided machines
    m_state = dict(EXISTING_MACHINE_MAX)
    from helpers import next_machine_code
    decided = {}
    for store_code, machine_name_raw, booth_num in tuples:
        norm = normalize(machine_name_raw)
        key = (store_code, norm)
        if key in registry or key in decided:
            continue
        mc = next_machine_code(store_code, m_state)
        decided[key] = mc
        registry[key] = mc
    return registry


if __name__ == '__main__':
    registry = build_full_machine_registry()
    donki_r = parse_donki_readings(registry)
    fks_r = parse_fukushige_readings(registry)
    all_r = donki_r + fks_r
    print(generate_readings_sql(all_r))
    print(f'\n-- Summary: {len(donki_r)} donki readings, {len(fks_r)} fukushige readings')
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/dfx/clawops
python -m pytest scripts/import_excel/tests/test_phase2.py -v
```

Expected: 2 passed

- [ ] **Step 5: Dry-run to verify**

```bash
python scripts/import_excel/phase2_readings.py 2>&1 | tail -5
```

Expected: `-- Summary: NNN donki readings, NNN fukushige readings` (no Python errors)

- [ ] **Step 6: Commit**

```bash
git add scripts/import_excel/phase2_readings.py scripts/import_excel/tests/test_phase2.py
git commit -m "feat: phase2 - meter_readings SQL generation"
```

---

## Task 5: phase3_zaiko.py (prize_stocks SQL)

**Files:**
- Create: `scripts/import_excel/phase3_zaiko.py`

棚卸リスト structure per sheet (= per staff person):
- Columns: 店舗(0), 景品名(1 or 2), 機械名(2 or 1), 単価(3), 倉庫①(4), 倉庫②(5), 機械内(6), 金額(7)
- Row 4 onward: data

Prize matching: fuzzy match 景品名 → prize_masters.prize_name (fetched at runtime).
Unmatched → create new prize_masters entry with status='unknown'.

owner mapping:
- 機械内 → owner_type='machine', owner_id = machine_code (matched by 機械名 + 店舗)
- 倉庫①/② → owner_type='location', owner_id = location_id per store (see below)

Store → location_id map (from existing locations table):
```
KGS01 → '鹿児島在庫', KGS02 → '宇宿', KGS03 → '薩摩川内', KGS04 → '都城',
KGS05 → '霧島隼人', KGS06 → '鹿屋', KRM02 → '久留米倉庫'
```

- [ ] **Step 1: Write phase3_zaiko.py**

```python
# scripts/import_excel/phase3_zaiko.py
"""
Parses 棚卸リスト and generates prize_stocks INSERT SQL.
Requires prize_masters data to be fetched first (passed as argument or loaded from JSON).
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import json
import openpyxl
from config import ZAIKO_FILE, STORE_MAP, IMPORT_TAG
from helpers import normalize, fuzzy_match, new_id, sq

ZAIKO_SHEETS = ['本田', '吉井', '中島', '久留米 ', '久留米(ドンキ景品)', '飯塚', '堤', '鹿児島', '塩川', '坂本']

# Store → default warehouse location_id for 倉庫 stock
STORE_LOCATION_MAP = {
    'KGU01': 'KGS02',  # 宇宿
    'STS01': 'KGS03',  # 薩摩川内
    'MYJ01': 'KGS04',  # 都城
    'KRH01': 'KGS05',  # 霧島隼人
    'KNY01': 'KGS06',  # 鹿屋
    'KGC01': 'KGS01',  # 鹿児島
    'IIZ01': 'IZK01',  # 飯塚
}
FALLBACK_LOCATION = 'KGS01'


def parse_zaiko_sheet(ws, prize_name_list, machine_registry):
    """
    Returns list of stock dicts:
      {prize_id, prize_name, owner_type, owner_id, quantity}
    """
    rows = list(ws.iter_rows(values_only=True))
    stocks = []
    new_prize_names = set()

    for row in rows[3:]:  # data starts row 4 (0-indexed: 3)
        if not row[0] and not row[1]:
            continue
        store_name = str(row[0]).strip() if row[0] else None
        # Some sheets have: 店舗, 機械名, 景品名, 単価, ...
        # Others:           店舗, 景品名, 機械名, 単価, ...
        # Detect by checking if row[1] looks like a machine name or prize name
        # Heuristic: if row[2] contains '倉庫'/'warehouse'-like numbers check row[1] vs row[2]
        # Safer: treat row[1] as 景品名, row[2] as 機械名 (most sheets)
        # Exception: 久留米 sheet has 景品名(1), 機械名(2) confirmed from row headers
        prize_name_raw = str(row[1]).strip() if row[1] else None
        machine_name_raw = str(row[2]).strip() if row[2] else None

        qty_s1 = row[4] if len(row) > 4 else None  # 倉庫①
        qty_s2 = row[5] if len(row) > 5 else None  # 倉庫②
        qty_m  = row[6] if len(row) > 6 else None  # 機械内

        if not prize_name_raw or prize_name_raw in ('景品名', '　', ''):
            continue

        store_code = STORE_MAP.get(store_name) if store_name else None

        # Fuzzy match prize
        matched = fuzzy_match(prize_name_raw, prize_name_list, cutoff=0.65)
        if matched:
            prize_id = matched  # will be resolved to actual ID in generate step
        else:
            prize_id = None
            new_prize_names.add(prize_name_raw)

        def add_stock(qty, owner_type, owner_id):
            if qty and isinstance(qty, (int, float)) and qty > 0:
                stocks.append({
                    'prize_name': prize_name_raw,
                    'prize_id': prize_id,  # None if unmatched
                    'owner_type': owner_type,
                    'owner_id': owner_id,
                    'quantity': int(qty),
                })

        # 機械内
        if machine_name_raw and store_code:
            norm_m = normalize(machine_name_raw)
            mc = machine_registry.get((store_code, norm_m))
            if mc:
                add_stock(qty_m, 'machine', mc)

        # 倉庫
        if store_code:
            loc = STORE_LOCATION_MAP.get(store_code, FALLBACK_LOCATION)
            add_stock(qty_s1, 'location', loc)
            add_stock(qty_s2, 'location', loc)

    return stocks, new_prize_names


def generate_zaiko_sql(prize_id_map, stocks):
    """
    prize_id_map: dict prize_name -> prize_id (from prize_masters)
    stocks: list of stock dicts from parse_zaiko_sheet
    """
    lines = ['-- ===== PRIZE STOCKS =====']
    for s in stocks:
        pid = prize_id_map.get(s['prize_name'])
        if not pid:
            continue  # skip unresolved (new prizes inserted separately)
        sid = new_id()
        lines.append(
            f"INSERT INTO prize_stocks "
            f"(stock_id, prize_id, owner_type, owner_id, quantity, "
            f"last_counted_at, last_counted_by, created_at, updated_at, updated_by) VALUES "
            f"({sq(sid)}, {sq(pid)}, {sq(s['owner_type'])}, {sq(s['owner_id'])}, "
            f"{s['quantity']}, NOW(), {sq(IMPORT_TAG)}, NOW(), NOW(), {sq(IMPORT_TAG)}) "
            f"ON CONFLICT DO NOTHING;"
        )
    return '\n'.join(lines)


def generate_new_prizes_sql(new_prize_names):
    """For unmatched prize names: insert minimal prize_masters records."""
    if not new_prize_names:
        return '-- No new prizes'
    lines = ['-- ===== NEW PRIZE_MASTERS (unmatched) =====']
    for name in sorted(new_prize_names):
        pid = 'IMP-' + new_id()[:8]
        lines.append(
            f"INSERT INTO prize_masters (prize_id, prize_name, status, created_at, updated_at, updated_by) "
            f"VALUES ({sq(pid)}, {sq(name)}, 'unknown', NOW(), NOW(), {sq(IMPORT_TAG)}) "
            f"ON CONFLICT DO NOTHING;"
        )
    return '\n'.join(lines)


if __name__ == '__main__':
    # prize_masters must be passed as JSON on stdin:
    # python phase3_zaiko.py < prizes.json
    # prizes.json = [{"prize_id": "...", "prize_name": "..."}]
    import json
    prizes_raw = json.load(sys.stdin)
    prize_name_list = [p['prize_name'] for p in prizes_raw]
    prize_id_map = {p['prize_name']: p['prize_id'] for p in prizes_raw}

    from phase1_masters import parse_donki_machines, parse_fukushige_machines, build_machine_registry
    from phase2_readings import build_full_machine_registry
    machine_registry = build_full_machine_registry()

    wb = openpyxl.load_workbook(ZAIKO_FILE, data_only=True)
    all_stocks = []
    all_new_prize_names = set()
    for sheet_name in ZAIKO_SHEETS:
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]
        stocks, new_names = parse_zaiko_sheet(ws, prize_name_list, machine_registry)
        all_stocks.extend(stocks)
        all_new_prize_names.update(new_names)

    print(generate_new_prizes_sql(all_new_prize_names))
    print()
    # Re-build prize_id_map including new prizes
    for name in all_new_prize_names:
        prize_id_map[name] = 'IMP-' + new_id()[:8]  # approximate; real IDs from SQL above
    print(generate_zaiko_sql(prize_id_map, all_stocks))
    print(f'\n-- Summary: {len(all_stocks)} stock entries, {len(all_new_prize_names)} new prizes')
```

- [ ] **Step 2: Fetch prize_masters to JSON for dry-run**

Run this SQL via Supabase MCP and save output as `scripts/import_excel/prizes.json`:

```sql
SELECT prize_id, prize_name FROM prize_masters WHERE status != 'discontinued' ORDER BY prize_id;
```

Then save the JSON array to `scripts/import_excel/prizes.json`.

- [ ] **Step 3: Dry-run**

```bash
cd /Users/dfx/clawops
python scripts/import_excel/phase3_zaiko.py < scripts/import_excel/prizes.json 2>&1 | tail -10
```

Expected: SQL output ending with `-- Summary: NNN stock entries, NNN new prizes`

- [ ] **Step 4: Commit**

```bash
git add scripts/import_excel/phase3_zaiko.py
git commit -m "feat: phase3 - prize_stocks SQL generation"
```

---

## Task 6: phase4_rental.py (billing_contracts + billing_events SQL)

**Files:**
- Create: `scripts/import_excel/phase4_rental.py`

レンタル売上表 structure:
- 番号 sheet: R0001～R2xxx = master rental contracts
  Columns: レンタル番号(0), 機械名(1), 歩率(2), 金種(3), 設置店(4)
- change sheet: monthly revenue per rental contract
  Row 0: date headers (cols 2, 7, 12, ... = every 5 cols)
  Rows 2+: per-machine rows with [機械名, レンタルNO, 歩率, 設置店, 売上, 取得]

billing_contracts.contract_type = 'rental'
billing_contracts.revenue_share = 歩率 (per contract)
billing_events: one per (store, month), machine_details = jsonb array of per-machine data

- [ ] **Step 1: Write phase4_rental.py**

```python
# scripts/import_excel/phase4_rental.py
"""
Parses レンタル売上表 3期.xlsx → billing_contracts + billing_events SQL.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import openpyxl
from datetime import datetime, date as date_class
import json
from config import RENTAL_FILE, STORE_MAP, DEFAULT_OPERATOR_ID, IMPORT_TAG
from helpers import new_id, sq, sql_date, to_date_or_none


def parse_rental_contracts():
    """Returns list of contract dicts from 番号 sheet."""
    wb = openpyxl.load_workbook(RENTAL_FILE, data_only=True)
    ws = wb['番号']
    contracts = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0] or not str(row[0]).startswith('R'):
            continue
        rental_no = str(row[0]).strip()
        machine_name = str(row[1]).strip() if row[1] else None
        revenue_share = float(row[2]) if row[2] and isinstance(row[2], (int, float)) else None
        store_name = str(row[4]).strip() if row[4] else None
        store_code = STORE_MAP.get(store_name)
        if not machine_name or not store_code:
            continue
        contracts.append({
            'contract_id': f'RENT-{rental_no}',
            'store_code': store_code,
            'operator_id': DEFAULT_OPERATOR_ID,
            'contract_type': 'rental',
            'revenue_share': revenue_share,
            'machine_name': machine_name,
            'rental_no': rental_no,
            'is_active': True,
        })
    return contracts


def parse_rental_events():
    """
    Returns list of monthly billing event dicts.
    Groups per (store_code, month), with machine_details jsonb.
    """
    wb = openpyxl.load_workbook(RENTAL_FILE, data_only=True)
    ws = wb['change']
    rows = list(ws.iter_rows(values_only=True))

    # Row 0: date headers at cols 2, 7, 12, 17, 22, 27, ...
    month_cols = []
    for col_i, v in enumerate(rows[0]):
        d = to_date_or_none(v) if not isinstance(v, str) else None
        if d and col_i >= 2:
            month_cols.append((col_i, d))

    # Rows 2+: data rows
    # Each row block is [機械名, レンタルNO, 歩率, 設置店, 売上, 取得, ''] repeated per month
    # The 7-column cycle: 歩率(+0), 設置店(+1), 売上(+2), 取得(+3), blank(+4), blank(+5), blank(+6)
    # So for month at col C: 売上 = row[C+2], 取得 = row[C+3]

    # Accumulate: {(store_code, month_date): {'total_sales': N, 'machines': []}}
    from collections import defaultdict
    events = defaultdict(lambda: {'total_sales': 0, 'machines': []})

    for row in rows[2:]:
        machine_name = str(row[0]).strip() if row[0] else None
        if not machine_name or machine_name in ('機械名', ''):
            continue

        for (base_col, month_date) in month_cols:
            store_col = base_col + 1
            sale_col  = base_col + 2
            take_col  = base_col + 3

            store_name = str(row[store_col]).strip() if store_col < len(row) and row[store_col] else None
            sale_v = row[sale_col] if sale_col < len(row) else None
            take_v = row[take_col] if take_col < len(row) else None

            if not isinstance(sale_v, (int, float)) or sale_v <= 0:
                continue

            store_code = STORE_MAP.get(store_name) if store_name else None
            if not store_code:
                continue

            key = (store_code, month_date)
            events[key]['total_sales'] += int(sale_v)
            events[key]['machines'].append({
                'machine_name': machine_name,
                'sales': int(sale_v),
                'take': int(take_v) if isinstance(take_v, (int, float)) else 0,
            })

    return events


def generate_contracts_sql(contracts):
    if not contracts:
        return '-- No contracts'
    lines = ['-- ===== BILLING CONTRACTS =====']
    for c in contracts:
        rs = c['revenue_share'] if c['revenue_share'] is not None else 'NULL'
        lines.append(
            f"INSERT INTO billing_contracts "
            f"(contract_id, store_code, operator_id, contract_type, revenue_share, "
            f"is_active, notes, created_at, updated_at, updated_by) VALUES "
            f"({sq(c['contract_id'])}, {sq(c['store_code'])}, {sq(c['operator_id'])}, "
            f"{sq(c['contract_type'])}, {rs}, TRUE, "
            f"{sq(c['rental_no'] + ' ' + c['machine_name'])}, "
            f"NOW(), NOW(), {sq(IMPORT_TAG)}) "
            f"ON CONFLICT (contract_id) DO NOTHING;"
        )
    return '\n'.join(lines)


def generate_events_sql(events):
    if not events:
        return '-- No events'
    lines = ['-- ===== BILLING EVENTS =====']
    import calendar
    for (store_code, month_date), data in sorted(events.items()):
        bid = new_id()
        last_day = calendar.monthrange(month_date.year, month_date.month)[1]
        period_from = month_date.replace(day=1)
        period_to = month_date.replace(day=last_day)
        machine_details_json = json.dumps(data['machines'], ensure_ascii=False).replace("'", "''")
        lines.append(
            f"INSERT INTO billing_events "
            f"(billing_id, store_code, billing_date, period_from, period_to, "
            f"total_sales, status, machine_details, created_by, created_at, updated_by) VALUES "
            f"({sq(bid)}, {sq(store_code)}, {sql_date(period_to)}, "
            f"{sql_date(period_from)}, {sql_date(period_to)}, "
            f"{data['total_sales']}, 'draft', "
            f"'{machine_details_json}', "
            f"{sq(IMPORT_TAG)}, NOW(), {sq(IMPORT_TAG)}) "
            f"ON CONFLICT DO NOTHING;"
        )
    return '\n'.join(lines)


if __name__ == '__main__':
    contracts = parse_rental_contracts()
    events = parse_rental_events()
    print(generate_contracts_sql(contracts))
    print()
    print(generate_events_sql(events))
    print(f'\n-- Summary: {len(contracts)} contracts, {len(events)} monthly billing events')
```

- [ ] **Step 2: Dry-run**

```bash
cd /Users/dfx/clawops
python scripts/import_excel/phase4_rental.py 2>&1 | tail -5
```

Expected: `-- Summary: NNN contracts, NNN monthly billing events`

- [ ] **Step 3: Commit**

```bash
git add scripts/import_excel/phase4_rental.py
git commit -m "feat: phase4 - billing_contracts + billing_events SQL generation"
```

---

## Task 7: run.py + final dry-run

**Files:**
- Create: `scripts/import_excel/run.py`

- [ ] **Step 1: Write run.py**

```python
# scripts/import_excel/run.py
"""
Orchestrates all 4 phases. Outputs SQL to stdout separated by phase markers.
Usage:
  python run.py                  # dry-run: prints SQL, does not execute
  python run.py --phase 1        # only phase 1
  python run.py --phase 2        # only phase 2

Execute each phase SQL via Supabase MCP execute_sql in order.
Phase ordering MUST be respected (stores before machines before booths before readings).
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))

import subprocess

def run_phase(n):
    scripts = {
        1: 'phase1_masters.py',
        2: 'phase2_readings.py',
        3: 'phase3_zaiko.py',
        4: 'phase4_rental.py',
    }
    print(f'\n\n-- ========================')
    print(f'-- PHASE {n}: {scripts[n]}')
    print(f'-- ========================\n')
    script = os.path.join(os.path.dirname(__file__), scripts[n])
    if n == 3:
        prizes_json = os.path.join(os.path.dirname(__file__), 'prizes.json')
        if not os.path.exists(prizes_json):
            print(f'-- SKIP phase 3: prizes.json not found. Fetch from Supabase first.')
            return
        with open(prizes_json) as f:
            result = subprocess.run(['python', script], stdin=f, capture_output=False)
    else:
        result = subprocess.run(['python', script], capture_output=False)

if __name__ == '__main__':
    phase = None
    if '--phase' in sys.argv:
        phase = int(sys.argv[sys.argv.index('--phase') + 1])

    phases = [phase] if phase else [1, 2, 3, 4]
    for p in phases:
        run_phase(p)
```

- [ ] **Step 2: Full dry-run phases 1, 2, 4**

```bash
cd /Users/dfx/clawops
python scripts/import_excel/run.py --phase 1 2>&1 | tail -5
python scripts/import_excel/run.py --phase 2 2>&1 | tail -5
python scripts/import_excel/run.py --phase 4 2>&1 | tail -5
```

Expected: each prints `-- Summary:` line with record counts, no Python errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/import_excel/run.py
git commit -m "feat: excel import run.py orchestrator"
```

---

## Task 8: Execute SQL via Supabase MCP

Execute in strict order. After each phase, verify with a COUNT query before proceeding.

- [ ] **Step 1: Execute Phase 1 - stores**

Run: `python scripts/import_excel/run.py --phase 1`
Copy the `-- NEW STORES` section SQL and execute via Supabase MCP `execute_sql`.
Verify: `SELECT COUNT(*) FROM stores;` → should be 39 + number of new stores

- [ ] **Step 2: Execute Phase 1 - machines**

Copy the `-- NEW MACHINES` section and execute via `execute_sql`.
Verify: `SELECT COUNT(*) FROM machines;` → 13 + new machines

- [ ] **Step 3: Execute Phase 1 - booths**

Copy the `-- NEW BOOTHS` section and execute via `execute_sql`.
Verify: `SELECT COUNT(*) FROM booths;`

- [ ] **Step 4: Fetch prize_masters for Phase 3**

Execute via Supabase MCP:
```sql
SELECT prize_id, prize_name FROM prize_masters WHERE status != 'discontinued' ORDER BY prize_id;
```
Save the result as `scripts/import_excel/prizes.json` (array of `{prize_id, prize_name}`).

- [ ] **Step 5: Execute Phase 3 - new prizes**

```bash
python scripts/import_excel/phase3_zaiko.py < scripts/import_excel/prizes.json 2>&1 > /tmp/phase3.sql
```
Copy `-- NEW PRIZE_MASTERS` section from `/tmp/phase3.sql` and execute via `execute_sql`.

- [ ] **Step 6: Execute Phase 3 - prize_stocks**

Copy `-- PRIZE STOCKS` section from `/tmp/phase3.sql` and execute via `execute_sql`.
Verify: `SELECT COUNT(*) FROM prize_stocks;`

- [ ] **Step 7: Execute Phase 2 - meter_readings**

```bash
python scripts/import_excel/phase2_readings.py > /tmp/phase2.sql
```
Execute via `execute_sql`. Note: meter_readings can be large (~5000+ rows), split into batches of 500 if needed.
Verify: `SELECT COUNT(*) FROM meter_readings;`

- [ ] **Step 8: Execute Phase 4 - billing_contracts**

```bash
python scripts/import_excel/phase4_rental.py > /tmp/phase4.sql
```
Copy `-- BILLING CONTRACTS` section and execute via `execute_sql`.
Verify: `SELECT COUNT(*) FROM billing_contracts;`

- [ ] **Step 9: Execute Phase 4 - billing_events**

Copy `-- BILLING EVENTS` section from `/tmp/phase4.sql` and execute via `execute_sql`.
Verify: `SELECT COUNT(*) FROM billing_events;`

- [ ] **Step 10: Final sanity check**

```sql
SELECT 'stores' as tbl, COUNT(*) FROM stores
UNION ALL SELECT 'machines', COUNT(*) FROM machines
UNION ALL SELECT 'booths', COUNT(*) FROM booths
UNION ALL SELECT 'meter_readings', COUNT(*) FROM meter_readings
UNION ALL SELECT 'prize_stocks', COUNT(*) FROM prize_stocks
UNION ALL SELECT 'billing_contracts', COUNT(*) FROM billing_contracts
UNION ALL SELECT 'billing_events', COUNT(*) FROM billing_events;
```

- [ ] **Step 11: Commit final state**

```bash
cd /Users/dfx/clawops
git add scripts/import_excel/
git commit -m "feat: excel import scripts complete - 4 phase import pipeline"
```
