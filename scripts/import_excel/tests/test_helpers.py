# scripts/import_excel/tests/test_helpers.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from helpers import normalize, fuzzy_match, next_machine_code, booth_code, sq, to_date_or_none
from datetime import date


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
    state = dict(EXISTING_MACHINE_MAX)  # copy so we don't mutate original
    assert next_machine_code('KOS01', state) == 'KOS01-M09'


def test_booth_code():
    assert booth_code('KNY01-M01', 3) == 'KNY01-M01-B03'


def test_sq_escapes_quotes():
    assert sq("it's") == "'it''s'"


def test_sq_none():
    assert sq(None) == 'NULL'


def test_to_date_excel_serial():
    # Excel serial 46000 should be a valid date
    d = to_date_or_none(46000)
    assert d is not None
    assert isinstance(d, date)


def test_to_date_none_input():
    assert to_date_or_none(None) is None


def test_to_date_string_input():
    assert to_date_or_none('not a date') is None
