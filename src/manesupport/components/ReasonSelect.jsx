import { AUDIT_REASONS } from '../../services/audit'

/**
 * 変更理由の選択コンポーネント
 * @param {{ value: { code: string, note: string }, onChange: (val: { code: string, note: string }) => void, reasons: string[], label?: string }} props
 */
export default function ReasonSelect({ value, onChange, reasons, label = '変更理由' }) {
  const entries = reasons.map(key => [key, AUDIT_REASONS[key] || key])

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted block">{label}</label>
      <select
        value={value.code}
        onChange={e => onChange({ code: e.target.value, note: e.target.value === 'OTHER' ? value.note : '' })}
        className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text"
      >
        <option value="">選択してください</option>
        {entries.map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      {value.code === 'OTHER' && (
        <input
          type="text"
          value={value.note}
          onChange={e => onChange({ ...value, note: e.target.value })}
          placeholder="理由を入力..."
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text"
        />
      )}
    </div>
  )
}
