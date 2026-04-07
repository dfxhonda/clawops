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

# Existing machine max M numbers per store (for generating new codes without conflicts)
EXISTING_MACHINE_MAX = {
    'KOS01': 8,   # M01~M08 exist
    'KKY01': 2,   # M01~M02 exist
    'MNK01': 2,   # M01~M02 exist
}
