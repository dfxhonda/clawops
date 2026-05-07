import { z } from 'zod'

export const MachineRowSchema = z.object({
  machine_code:      z.string(),
  store_code:        z.string(),
  machine_name:      z.string().nullable(),
  machine_number:    z.string().nullable(),
  type_id:           z.number().nullable(),
  model_id:          z.string().nullable(),
  play_price:        z.number().nullable(),
  notes:             z.string().nullable(),
  is_active:         z.boolean(),
  meter_unit_price:  z.number(),
  out_meter_count:   z.number(),
  organization_id:   z.string(),
  created_at:        z.string().nullable(),
  updated_at:        z.string().nullable(),
})
