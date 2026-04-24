-- entry_type 列にコメント追加
COMMENT ON COLUMN meter_readings.entry_type IS
  'actual=メーター実読 | carry_forward=据え置き確定(前回値のまま) | replace=機械交換 | patrol=旧型式(廃止予定)';
