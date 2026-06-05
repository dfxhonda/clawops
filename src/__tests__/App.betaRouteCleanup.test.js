// SPEC-PATROL-BETA-ROUTE-CLEANUP-01
// App.jsx から /clawsupport/beta/* route と PatrolBoothInputPageBeta import が除去されたことを確認する回帰テスト
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const appSource = readFileSync(resolve(__dirname, '../App.jsx'), 'utf-8')

describe('App.jsx beta route cleanup (SPEC-PATROL-BETA-ROUTE-CLEANUP-01)', () => {
  it('when_beta_route_removed_should_not_contain_clawsupport_beta_path', () => {
    expect(appSource).not.toContain('/clawsupport/beta')
  })

  it('when_PatrolBoothInputPageBeta_removed_should_not_import_it', () => {
    expect(appSource).not.toContain('PatrolBoothInputPageBeta')
  })
})
