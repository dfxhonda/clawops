import { z } from 'zod'

export const RevenueByStoreRowSchema = z.object({
  store_code: z.string(),
  store_name: z.string(),
  revenue: z.number(),
  share: z.number(),
  payout_rate: z.number(),
  machine_count: z.number().int(),
})

export const RevenueByMachineRowSchema = z.object({
  machine_code: z.string(),
  store_name: z.string(),
  machine_name: z.string().nullable(),
  revenue: z.number(),
  payout_rate: z.number(),
})

export const RevenueByPrizeRowSchema = z.object({
  prize_id: z.string().nullable(),
  prize_name: z.string().nullable(),
  revenue: z.number(),
  prize_cost_avg: z.number(),
  profit_margin: z.number(),
})

export const KpiSummarySchema = z.object({
  revenue: z.number(),
  prev_revenue: z.number(),
  machine_count: z.number().int(),
  payout_rate_avg: z.number(),
  patrol_completion_rate: z.number(),
})
