import DiffChip from './DiffChip'

// 巡回入力の差分チップ(IN差/OUT差)。正=緑/負=赤/0/null=グレー。
export default {
  title: 'clawsupport/DiffChip',
  component: DiffChip,
  tags: ['autodocs'],
  args: { label: 'IN' },
  argTypes: {
    value: { control: 'number' },
    label: { control: 'text' },
  },
}

export const Positive = { args: { label: 'IN', value: 12345 } }
export const Negative = { args: { label: 'OUT', value: -800 } }
export const Zero = { args: { label: 'IN', value: 0 } }
export const Empty = { args: { label: 'OUT', value: null } }
