-- J-INTAKE-PCH-EXCEL-fix-01 pre_migration
-- PCH Excel に小数ケース数(3.25/0.5)・小数配分が実在するため case_count/pieces_per_case を numeric化。
-- 既存SGPデータ(2427行)は全て整数値、numeric変換後も値不変 (information_schema突合済)。
ALTER TABLE prize_orders
  ALTER COLUMN case_count TYPE numeric USING case_count::numeric,
  ALTER COLUMN pieces_per_case TYPE numeric USING pieces_per_case::numeric;
