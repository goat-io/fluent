import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import rimraf from 'rimraf'

export const Folder = (() => {
  /**
   *
   * @param dir
   */
  const remove = (dir: string) => rimraf.sync(dir)
  /**
   *
   * @param filePath
   */
  const findOrCreate = filePath => {
    const dir = dirname(filePath)
    if (existsSync(dir)) {
      return true
    }

    mkdirSync(dir)

    return findOrCreate(dirname)
  }
  /**
   *
   */
  const isGoatFolder = (): boolean => {
    const fastDirname = '.goat'
    return existsSync(fastDirname)
  }

  return Object.freeze({ isGoatFolder, remove, findOrCreate })
})()
