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


def fuzzy_match(name: str, candidates: list, cutoff=0.6):
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
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)) and 40000 < v < 60000:
        return date.fromordinal(date(1899, 12, 30).toordinal() + int(v))
    return None
