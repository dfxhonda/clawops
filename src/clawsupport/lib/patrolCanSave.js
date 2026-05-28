// 巡回保存ボタンの有効化判定。
// INメーター入力があれば保存可。OUTメーター/在庫は任意。
// (OUT機能オフのライド機など OUT/在庫が無い機種も、他機種と共通仕様でIN単独保存できる)
export function patrolCanSave(inMeter) {
  return inMeter !== '' && inMeter != null
}
