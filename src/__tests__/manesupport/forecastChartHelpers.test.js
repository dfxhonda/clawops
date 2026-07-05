// SPEC-ADMIN-FORECAST-CYCLE-S2-UI-01: chart data transform pure functions
import { describe, it, expect } from 'vitest'
import { buildChartData, pickMilestones } from '../../manesupport/pages/ForecastDetail'

describe('buildChartData', () => {
  it('when_last_actual_day_has_no_projected_value_should_patch_it_to_connect_lines', () => {
    const daily = [
      { d: '2026-06-16', actual_cum: 0, projected_cum: null },
      { d: '2026-06-17', actual_cum: 100, projected_cum: null },
      { d: '2026-06-18', actual_cum: null, projected_cum: 150 },
    ]
    const result = buildChartData(daily)
    expect(result[1]).toEqual({ d: '2026-06-17', actual_cum: 100, projected_cum: 100 })
    expect(result[0]).toEqual({ d: '2026-06-16', actual_cum: 0, projected_cum: null })
    expect(result[2]).toEqual({ d: '2026-06-18', actual_cum: null, projected_cum: 150 })
  })

  it('when_no_actual_rows_should_leave_all_rows_unchanged', () => {
    const daily = [{ d: '2026-06-16', actual_cum: null, projected_cum: 10 }]
    expect(buildChartData(daily)).toEqual(daily)
  })

  it('when_daily_is_empty_or_null_should_return_empty_array', () => {
    expect(buildChartData([])).toEqual([])
    expect(buildChartData(null)).toEqual([])
    expect(buildChartData(undefined)).toEqual([])
  })
})

describe('pickMilestones', () => {
  it('when_rows_span_more_than_5_days_should_pick_every_5th_index_plus_last', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      d: `day-${i}`, actual_cum: i < 8 ? i * 10 : null, projected_cum: i >= 8 ? i * 10 : null,
    }))
    const milestones = pickMilestones(rows)
    expect(milestones.map(m => m.d)).toEqual(['day-0', 'day-5', 'day-10', 'day-11'])
    expect(milestones[milestones.length - 1].isLanding).toBe(true)
    expect(milestones[0].isLanding).toBe(false)
  })

  it('when_rows_empty_should_return_empty_array', () => {
    expect(pickMilestones([])).toEqual([])
  })

  it('when_row_value_is_projected_only_should_use_projected_cum_as_value', () => {
    const rows = [{ d: 'day-0', actual_cum: null, projected_cum: 500 }]
    const milestones = pickMilestones(rows)
    expect(milestones[0].value).toBe(500)
  })
})
