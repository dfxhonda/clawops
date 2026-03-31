import MasterListDB from './MasterListDB'

const FIELDS = [
  { key: 'status_id', label: 'ステータスID', required: true, placeholder: 'ok' },
  { key: 'status_name', label: 'ステータス名', required: true, placeholder: '正常' },
  { key: 'color', label: '色コード', placeholder: '#44aa44' },
  { key: 'sort_order', label: '表示順', type: 'number', default: 0 },
]

export default function PatrolStatusDB() {
  return <MasterListDB table="patrol_statuses" title="巡回ステータス" pkField="status_id" fields={FIELDS} />
}
