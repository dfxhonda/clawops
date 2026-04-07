# scripts/import_excel/tests/test_phase2.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from datetime import date
from phase2_readings import extract_readings_from_block


def test_extract_readings_detects_first_and_changes():
    """First date always included; subsequent dates only if value changes."""
    dates = [(2, date(2026, 3, 19)), (3, date(2026, 3, 20)), (4, date(2026, 3, 22))]
    in_vals  = [None, None, 4201, 4201, 4281]
    out_vals = [None, None, 292,  292,  296]
    readings = extract_readings_from_block(in_vals, out_vals, dates)
    assert len(readings) == 2
    assert readings[0] == {'date': date(2026, 3, 19), 'in_meter': 4201, 'out_meter': 292}
    assert readings[1] == {'date': date(2026, 3, 22), 'in_meter': 4281, 'out_meter': 296}


def test_extract_readings_all_same():
    """When all values are the same, only first date is included."""
    dates = [(2, date(2026, 3, 19)), (3, date(2026, 3, 20))]
    in_vals  = [None, None, 5000, 5000]
    out_vals = [None, None, 100,  100]
    readings = extract_readings_from_block(in_vals, out_vals, dates)
    assert len(readings) == 1
    assert readings[0]['in_meter'] == 5000


def test_extract_readings_skips_non_numeric():
    """Non-numeric in_vals are skipped."""
    dates = [(2, date(2026, 3, 19)), (3, date(2026, 3, 20))]
    in_vals  = [None, None, None, 4000]
    out_vals = [None, None, None, 100]
    readings = extract_readings_from_block(in_vals, out_vals, dates)
    assert len(readings) == 1
    assert readings[0]['date'] == date(2026, 3, 20)
