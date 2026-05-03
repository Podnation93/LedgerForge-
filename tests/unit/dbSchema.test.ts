import { getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ledgerforgeTables } from '../../src/main/db/schema'

interface RawTable {
  name: string
  columns: string[]
}

function rawSchemaSource(): string {
  return readFileSync(join(process.cwd(), 'src/main/db/index.ts'), 'utf8')
}

function rawTables(): RawTable[] {
  const source = rawSchemaSource()
  return Array.from(source.matchAll(/CREATE TABLE IF NOT EXISTS ([\w_]+) \(([\s\S]*?)\n {4}\);/g)).map((match) => ({
    name: match[1],
    columns: match[2]
      .split('\n')
      .map((line) => line.trim().replace(/,$/, ''))
      .filter(Boolean)
      .map((line) => line.split(/\s+/)[0]),
  }))
}

function rawIndexes(): string[] {
  return Array.from(rawSchemaSource().matchAll(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS ([\w_]+)/g))
    .map((match) => match[1])
    .sort()
}

describe('Drizzle schema mirror', () => {
  it('matches the current raw-SQL tables, columns, and indexes', () => {
    const drizzleTableNames = ledgerforgeTables.map((table) => getTableName(table)).sort()
    expect(drizzleTableNames).toEqual(rawTables().map((table) => table.name).sort())

    const rawTableColumns = new Map(rawTables().map((table) => [table.name, table.columns]))
    for (const table of ledgerforgeTables) {
      const tableName = getTableName(table)
      const drizzleColumns = getTableConfig(table).columns.map((column) => column.name)
      expect(drizzleColumns).toEqual(rawTableColumns.get(tableName))
    }

    const drizzleIndexes = ledgerforgeTables
      .flatMap((table) => getTableConfig(table).indexes.map((tableIndex) => tableIndex.config.name))
      .sort()
    expect(drizzleIndexes).toEqual(rawIndexes())
  })
})
