import MasterListDB from './MasterListDB'

const FIELDS = [
  { key: 'type_id', label: 'タイプID', required: true, placeholder: 'loc2loc' },
  { key: 'type_name', label: 'タイプ名', required: true, placeholder: '拠点→拠点' },
  { key: 'sort_order', label: '表示順', type: 'number', default: 0 },
]

export default function TransferTypeDB() {
  return <MasterListDB table="transfer_types" title="移管タイプ" pkField="type_id" fields={FIELDS} />
}
