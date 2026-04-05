// ============================================
// Supabase ステートフルモック
// テストごとに createMockSupabase(initialData) で fresh インスタンスを生成
// サービス層の結合テスト用（supabaseレベルでモック）
// ============================================

let idCounter = 0

/**
 * インメモリDBを持つSupabaseモックを生成
 * @param {Object} initialData - { tableName: [rows...], ... }
 * @param {Object} [sessionData] - auth.getSession() の戻り値
 */
export function createMockSupabase(initialData = {}, sessionData = null) {
  // テーブルごとの配列（deep copy）
  const db = {}
  for (const [table, rows] of Object.entries(initialData)) {
    db[table] = rows.map(r => ({ ...r }))
  }

  // テーブル取得（なければ空配列を自動作成）
  function getTable(name) {
    if (!db[name]) db[name] = []
    return db[name]
  }

  // クエリビルダー
  function createQueryBuilder(tableName) {
    let operation = null   // 'select' | 'insert' | 'update'
    let insertRow = null
    let updatePatch = null
    let filters = []       // [{ col, val }]
    let orderCol = null
    let orderAsc = true
    let rangeFrom = null
    let rangeTo = null
    let selectCols = null
    let wantSingle = false

    const builder = {
      select(cols) {
        // insert後のselectはinsert操作の一部（operationは上書きしない）
        if (operation !== 'insert') operation = 'select'
        selectCols = cols || '*'
        return builder
      },
      insert(row) {
        operation = 'insert'
        insertRow = { ...row }
        return builder
      },
      update(patch) {
        operation = 'update'
        updatePatch = { ...patch }
        return builder
      },
      eq(col, val) {
        filters.push({ col, val })
        return builder
      },
      order(col, opts) {
        orderCol = col
        orderAsc = opts?.ascending !== false
        return builder
      },
      range(from, to) {
        rangeFrom = from
        rangeTo = to
        return builder
      },
      single() {
        wantSingle = true
        return builder
      },
      // Thenable — resolves the chain
      then(resolve, reject) {
        try {
          const result = executeQuery()
          resolve(result)
        } catch (e) {
          if (reject) reject(e)
        }
      },
    }

    function executeQuery() {
      const table = getTable(tableName)

      if (operation === 'insert') {
        // generate IDs for common patterns
        const row = { ...insertRow }
        if (!row.stock_id && tableName === 'prize_stocks') row.stock_id = `mock-stock-${++idCounter}`
        if (!row.movement_id && tableName === 'stock_movements') row.movement_id = `mock-mv-${++idCounter}`
        if (!row.reading_id && tableName === 'meter_readings') row.reading_id = `mock-rd-${++idCounter}`
        table.push(row)

        if (selectCols && wantSingle) {
          // .insert(row).select('col').single() pattern
          const col = selectCols.trim()
          return { data: { [col]: row[col] }, error: null }
        }
        // .insert(row) pattern (no select)
        return { data: null, error: null }
      }

      if (operation === 'update') {
        // Apply filters
        let targets = table
        for (const f of filters) {
          targets = targets.filter(r => r[f.col] === f.val)
        }
        // Patch matching rows in-place
        for (const row of targets) {
          Object.assign(row, updatePatch)
        }
        return { data: null, error: null }
      }

      if (operation === 'select') {
        let rows = [...table]
        // Apply filters
        for (const f of filters) {
          rows = rows.filter(r => r[f.col] === f.val)
        }
        // Order
        if (orderCol) {
          rows.sort((a, b) => {
            const va = a[orderCol] ?? ''
            const vb = b[orderCol] ?? ''
            return orderAsc ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0)
          })
        }
        // Range
        if (rangeFrom !== null && rangeTo !== null) {
          rows = rows.slice(rangeFrom, rangeTo + 1)
        }
        if (wantSingle) {
          return { data: rows[0] || null, error: null }
        }
        return { data: rows, error: null }
      }

      return { data: null, error: null }
    }

    return builder
  }

  const mock = {
    from(tableName) {
      return createQueryBuilder(tableName)
    },
    auth: {
      getSession: () => Promise.resolve({
        data: { session: sessionData },
      }),
      signOut: () => Promise.resolve(),
    },
    // テスト用ヘルパー: DB内容を直接参照
    _db: db,
    _getTable: getTable,
  }

  return mock
}
