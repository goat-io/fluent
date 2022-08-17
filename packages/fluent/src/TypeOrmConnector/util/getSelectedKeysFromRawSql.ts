/**
 * 
 * @param sql 
 * @returns 
 */
export const getSelectedKeysFromRawSql = (sql: string): string[] => {
  const possibleKeys = sql.split('AS')
  const keys: Set<string> = new Set([])

  for (const stringKey of possibleKeys) {
    if (stringKey.includes('SELECT')) {
      const key = stringKey.split('"')[1]
      if (key.includes('___') || !key.includes('_')) {
        continue
      }

      keys.add(key.replace('_id', 'id').replace('_', '.'))

      continue
    }

    keys.add(stringKey.split('"')[1].replace('_id', 'id').replace('_', '.'))
  }

  return Array.from(keys)
}
