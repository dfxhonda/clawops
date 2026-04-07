#!/usr/bin/env python3
# scripts/import_excel/run.py
"""
Orchestrates all 4 Excel import phases.
Outputs SQL to stdout — execute each phase via Supabase MCP.

Usage:
  python run.py                  # run all 4 phases
  python run.py --phase 1        # only phase 1 (stores/machines/booths)
  python run.py --phase 2        # only phase 2 (meter_readings)
  python run.py --phase 3        # only phase 3 (prize_stocks) — needs prizes.json
  python run.py --phase 4        # only phase 4 (billing_contracts/events)

Phase 3 reads prize_masters JSON from stdin:
  python run.py --phase 3 < prizes.json

Execute SQL in this order:
  1. Phase 1 stores → verify stores table
  2. Phase 1 machines → verify machines table
  3. Phase 1 booths → verify booths table
  4. Phase 3 new prizes → verify prize_masters table
  5. Phase 3 prize_stocks → verify prize_stocks table
  6. Phase 2 meter_readings → verify meter_readings table
  7. Phase 4 billing_contracts → verify billing_contracts table
  8. Phase 4 billing_events → verify billing_events table
"""
import sys
import os
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def run_phase(n, stdin_data=None):
    scripts = {
        1: 'phase1_masters.py',
        2: 'phase2_readings.py',
        3: 'phase3_zaiko.py',
        4: 'phase4_rental.py',
    }
    script_name = scripts[n]
    script_path = os.path.join(SCRIPT_DIR, script_name)

    print(f'\n-- ========================================')
    print(f'-- PHASE {n}: {script_name}')
    print(f'-- ========================================\n')

    if n == 3:
        prizes_path = os.path.join(SCRIPT_DIR, 'prizes.json')
        if stdin_data:
            proc = subprocess.run(
                [sys.executable, script_path],
                input=stdin_data, text=True, cwd=SCRIPT_DIR
            )
        elif os.path.exists(prizes_path):
            with open(prizes_path) as f:
                proc = subprocess.run(
                    [sys.executable, script_path],
                    stdin=f, cwd=SCRIPT_DIR
                )
        else:
            print(f'-- SKIP phase 3: prizes.json not found at {prizes_path}')
            print('-- To run phase 3: python run.py --phase 3 < prizes.json')
            print('-- Fetch prizes.json from Supabase: SELECT prize_id, prize_name FROM prize_masters;')
            return
    else:
        proc = subprocess.run(
            [sys.executable, script_path],
            cwd=SCRIPT_DIR
        )


if __name__ == '__main__':
    phase = None
    stdin_data = None

    if '--phase' in sys.argv:
        idx = sys.argv.index('--phase')
        if idx + 1 < len(sys.argv):
            phase = int(sys.argv[idx + 1])

    # If phase 3 and stdin is a pipe, read it
    if phase == 3 and not sys.stdin.isatty():
        stdin_data = sys.stdin.read()

    phases = [phase] if phase else [1, 2, 3, 4]
    for p in phases:
        run_phase(p, stdin_data if p == 3 else None)
