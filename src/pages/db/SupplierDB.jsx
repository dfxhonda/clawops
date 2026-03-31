import MasterListDB from './MasterListDB'

const FIELDS = [
  { key: 'supplier_id', label: '仕入先ID', required: true, placeholder: 'SGP' },
  { key: 'supplier_name', label: '仕入先名', required: true, placeholder: '景品フォーム' },
  { key: 'supplier_type', label: 'タイプ', options: [
    { value: 'distributor', label: '卸業者' }, { value: 'maker', label: 'メーカー' },
    { value: 'platform', label: 'プラットフォーム' }, { value: 'mercari', label: 'メルカリ' },
    { value: 'online', label: 'オンライン' }, { value: 'retail', label: '店舗購入' },
    { value: 'other', label: 'その他' },
  ]},
  { key: 'contact_method', label: '連絡方法', placeholder: 'web_form / line / visit' },
  { key: 'order_method', label: '発注方法', placeholder: 'web / fax / line' },
  { key: 'lead_time_days', label: 'リードタイム(日)', type: 'number' },
  { key: 'is_active', label: '有効', type: 'boolean', default: true },
  { key: 'notes', label: 'メモ' },
]

export default function SupplierDB() {
  return <MasterListDB table="suppliers" title="仕入先" pkField="supplier_id" fields={FIELDS} orderField="supplier_id" />
}
