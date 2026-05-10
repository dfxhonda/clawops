import { fetchBoothDiffMap } from './boothHistory'

export async function fetchStoreMachineDiffs(machines) {
  const boothCodes = machines.flatMap(m => (m.booths ?? []).map(b => b.booth_code))
  if (!boothCodes.length) return { diffMap: {}, storeInTotal: null, storeOutTotal: null }

  const diffMap = await fetchBoothDiffMap(boothCodes, {})

  let storeInTotal = null
  let storeOutTotal = null

  for (const d of Object.values(diffMap)) {
    if (!d) continue
    if (d.inDiff != null) storeInTotal = (storeInTotal ?? 0) + d.inDiff
    if (d.outDiff != null) storeOutTotal = (storeOutTotal ?? 0) + d.outDiff
  }

  return { diffMap, storeInTotal, storeOutTotal }
}
