import MasterListDB from './MasterListDB'

const FIELDS = [
  { key: 'category_id', label: 'カテゴリID', required: true, placeholder: 'crane' },
  { key: 'category_name', label: 'カテゴリ名', required: true, placeholder: 'クレーン' },
  { key: 'sort_order', label: '表示順', type: 'number', default: 0 },
]

export default function MachineCategoryDB() {
  return <MasterListDB table="machine_categories" title="マシンカテゴリ" pkField="category_id" fields={FIELDS} />
}
