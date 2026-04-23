/**
 * Minimal Kysely-compatible query builder for test code.
 *
 * Wraps DbClient and provides `.selectFrom()`, `.insertInto()`,
 * `.updateTable()`, `.deleteFrom()` chains so test files don't
 * need 300+ hand-written raw SQL conversions.
 *
 * NOT for production use — only imported by test helpers.
 */
import type { DbClient } from './DbClient.js'

type Row = Record<string, any>

// ── Helpers ──────────────────────────────────────────────────────
function quoteCol(col: string): string {
  return /[A-Z]/.test(col) ? `"${col}"` : col
}

function _placeholders(start: number, count: number): string {
  return Array.from({ length: count }, (_, i) => `$${start + i}`).join(', ')
}

// ── Select Builder ──────────────────────────────────────────────
class SelectBuilder<T = any> {
  private table: string
  private db: DbClient
  private cols: string[] = ['*']
  private wheres: Array<{ col: string; op: string; value: any }> = []
  private orderBys: Array<{ col: string; dir: string }> = []

  constructor(db: DbClient, table: string) {
    this.db = db
    this.table = table
  }

  selectAll() {
    this.cols = ['*']
    return this
  }

  select(col: string | string[] | any) {
    if (typeof col === 'string') {
      this.cols = [col]
    } else if (Array.isArray(col)) {
      this.cols = col
    } else {
      // Handle sql expression objects — just pass through as raw
      this.cols = [col]
    }
    return this as any
  }

  where(col: string, op: string, value?: any) {
    if (value === undefined) {
      // 2-arg form: where(col, value)
      this.wheres.push({ col, op: '=', value: op })
    } else {
      this.wheres.push({ col, op, value })
    }
    return this
  }

  orderBy(col: string, dir: string = 'asc') {
    this.orderBys.push({ col, dir })
    return this
  }

  private buildQuery(): { text: string; params: any[] } {
    const colStr = this.cols
      .map(c => (typeof c === 'string' ? (c === '*' ? '*' : quoteCol(c)) : c))
      .join(', ')
    let text = `SELECT ${colStr} FROM ${this.table}`
    const params: any[] = []
    let idx = 1

    for (const w of this.wheres) {
      const prefix = params.length === 0 ? ' WHERE' : ' AND'
      if (w.op === 'in' && Array.isArray(w.value)) {
        const ph = w.value.map(() => `$${idx++}`).join(', ')
        text += `${prefix} ${quoteCol(w.col)} IN (${ph})`
        params.push(...w.value)
      } else {
        text += `${prefix} ${quoteCol(w.col)} ${w.op} $${idx++}`
        params.push(w.value)
      }
    }

    for (let i = 0; i < this.orderBys.length; i++) {
      const ob = this.orderBys[i]
      text += i === 0 ? ' ORDER BY' : ','
      text += ` ${quoteCol(ob.col)} ${ob.dir}`
    }

    return { text, params }
  }

  async execute(): Promise<T[]> {
    const { text, params } = this.buildQuery()
    const { rows } = await this.db.query<T>(text, params)
    return rows
  }

  async executeTakeFirst(): Promise<T | undefined> {
    const { text, params } = this.buildQuery()
    const { rows } = await this.db.query<T>(`${text} LIMIT 1`, params)
    return rows[0]
  }

  async executeTakeFirstOrThrow(): Promise<T> {
    const result = await this.executeTakeFirst()
    if (!result) {
      throw new Error(`No row found in ${this.table}`)
    }
    return result
  }
}

// ── Insert Builder ──────────────────────────────────────────────
class InsertBuilder<_T = any> {
  private table: string
  private db: DbClient
  private rows: Row[] = []

  constructor(db: DbClient, table: string) {
    this.db = db
    this.table = table
  }

  values(data: Row | Row[]) {
    this.rows = Array.isArray(data) ? data : [data]
    return this
  }

  async execute(): Promise<void> {
    if (this.rows.length === 0) {
      return
    }

    for (const row of this.rows) {
      const keys = Object.keys(row)
      const cols = keys.map(quoteCol).join(', ')
      const ph = keys.map((_, i) => `$${i + 1}`).join(', ')
      const vals = keys.map(k => row[k])
      await this.db.query(
        `INSERT INTO ${this.table} (${cols}) VALUES (${ph})`,
        vals,
      )
    }
  }
}

// ── Update Builder ──────────────────────────────────────────────
class UpdateBuilder {
  private table: string
  private db: DbClient
  private setData: Row = {}
  private wheres: Array<{ col: string; op: string; value: any }> = []

  constructor(db: DbClient, table: string) {
    this.db = db
    this.table = table
  }

  set(data: Row) {
    this.setData = data
    return this
  }

  where(col: string, op: string, value?: any) {
    if (value === undefined) {
      this.wheres.push({ col, op: '=', value: op })
    } else {
      this.wheres.push({ col, op, value })
    }
    return this
  }

  async execute(): Promise<void> {
    const keys = Object.keys(this.setData)
    if (keys.length === 0) {
      return
    }

    let idx = 1
    const setClauses = keys.map(k => `${quoteCol(k)} = $${idx++}`).join(', ')
    const setValues = keys.map(k => this.setData[k])

    let text = `UPDATE ${this.table} SET ${setClauses}`
    const params = [...setValues]

    for (const w of this.wheres) {
      const prefix = params.length === setValues.length ? ' WHERE' : ' AND'
      if (w.op === 'in' && Array.isArray(w.value)) {
        const ph = w.value.map(() => `$${idx++}`).join(', ')
        text += `${prefix} ${quoteCol(w.col)} IN (${ph})`
        params.push(...w.value)
      } else {
        text += `${prefix} ${quoteCol(w.col)} ${w.op} $${idx++}`
        params.push(w.value)
      }
    }

    await this.db.query(text, params)
  }
}

// ── Delete Builder ──────────────────────────────────────────────
class DeleteBuilder {
  private table: string
  private db: DbClient
  private wheres: Array<{ col: string; op: string; value: any }> = []

  constructor(db: DbClient, table: string) {
    this.db = db
    this.table = table
  }

  where(col: string, op: string, value?: any) {
    if (value === undefined) {
      this.wheres.push({ col, op: '=', value: op })
    } else {
      this.wheres.push({ col, op, value })
    }
    return this
  }

  async execute(): Promise<void> {
    let text = `DELETE FROM ${this.table}`
    const params: any[] = []
    let idx = 1

    for (const w of this.wheres) {
      const prefix = params.length === 0 ? ' WHERE' : ' AND'
      text += `${prefix} ${quoteCol(w.col)} ${w.op} $${idx++}`
      params.push(w.value)
    }

    await this.db.query(text, params)
  }
}

// ── Fn helper ───────────────────────────────────────────────────
class FnHelper {
  count<_T = number>(col: string) {
    return {
      as: (alias: string) => `count(${quoteCol(col)})::int as ${alias}`,
    }
  }
  countAll() {
    return {
      as: (alias: string) => `count(*)::int as ${alias}`,
    }
  }
}

/**
 * Extends DbClient with Kysely-like query builder methods for tests.
 */
export interface TestDb extends DbClient {
  selectFrom<T = any>(table: string): SelectBuilder<T>
  insertInto(table: string): InsertBuilder
  updateTable(table: string): UpdateBuilder
  deleteFrom(table: string): DeleteBuilder
  fn: FnHelper
}

export function wrapTestDb(db: DbClient): TestDb {
  const wrapped = Object.create(db) as TestDb
  wrapped.query = db.query.bind(db)
  wrapped.getPool = db.getPool.bind(db)
  wrapped.transaction = db.transaction.bind(db)
  wrapped.destroy = db.destroy.bind(db)
  wrapped.selectFrom = <T = any>(table: string) =>
    new SelectBuilder<T>(db, table)
  wrapped.insertInto = (table: string) => new InsertBuilder(db, table)
  wrapped.updateTable = (table: string) => new UpdateBuilder(db, table)
  wrapped.deleteFrom = (table: string) => new DeleteBuilder(db, table)
  wrapped.fn = new FnHelper()
  return wrapped
}
