import MasterListDB from './MasterListDB'

const FIELDS = [
  { key: 'type_id', label: 'タイプID', required: true, placeholder: 'purchased' },
  { key: 'type_name', label: 'タイプ名', required: true, placeholder: '購入' },
  { key: 'sort_order', label: '表示順', type: 'number', default: 0 },
]

export default function OwnershipTypeDB() {
  return <MasterListDB table="ownership_types" title="所有形態" pkField="type_id" fields={FIELDS} />
}
