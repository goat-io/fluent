import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import { existsSync, mkdirSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import * as path from 'node:path'
import { dirname, join } from 'node:path'
import { Promises } from '@goatlab/js-utils'

class FoldersClass {
  /**
   * Removes a directory and all its contents synchronously
   * @param dir - The directory path to remove
   */
  removeSync = (dir: string) => {
    if (!fs.existsSync(dir)) {
      return
    }

    const stack = [dir]
    const toRemove: string[] = []

    // Build list of all files and directories
    while (stack.length > 0) {
      const currentDir = stack.pop()!
      toRemove.push(currentDir)

      for (const entry of fs.readdirSync(currentDir)) {
        const fullPath = path.join(currentDir, entry)
        const stat = fs.lstatSync(fullPath)
        if (stat.isDirectory()) {
          stack.push(fullPath)
        } else {
          fs.unlinkSync(fullPath)
        }
      }
    }

    // Remove directories in reverse order (deepest first)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      fs.rmdirSync(toRemove[i]!)
    }
  }

  /**
   * Ensures a directory exists by creating it if it doesn't exist
   * @param filePath - The file path whose directory should be created
   * @returns Always returns true
   */
  findOrCreate = (filePath: string) => {
    const dir = dirname(filePath)
    if (existsSync(dir)) {
      return true
    }

    mkdirSync(dir, { recursive: true })
    return true
  }

  /**
   * Generates a SHA-256 hash representing the contents and structure of a directory.
   *
   * Recursively traverses the specified directory, including all subdirectories and files,
   * and computes a hash based on both the file contents and their relative paths.
   * The order of directory entries is sorted to ensure consistent hashing across runs.
   *
   * @param directory - The root directory to hash.
   * @returns A hexadecimal string representing the SHA-256 hash of the directory's contents and structure.
   */
  hash(directory: string): string {
    const hash = crypto.createHash('sha256')
    const stack: [string, string[]][] = [
      [directory, fs.readdirSync(directory).sort()]
    ]

    while (stack.length > 0) {
      const [currentDir, entries] = stack.pop()!

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!
        const fullPath = path.join(currentDir, entry)
        const relativePath = path.relative(directory, fullPath)
        const stat = fs.statSync(fullPath)

        hash.update(relativePath) // include relative path to differentiate same-named files
        if (stat.isDirectory()) {
          const dirEntries = fs.readdirSync(fullPath).sort()
          stack.push([fullPath, dirEntries])
        } else {
          hash.update(fs.readFileSync(fullPath))
        }
      }
    }

    return hash.digest('hex')
  }

  /**
   * Recursively searches for files within a directory and its subdirectories.
   * Optionally filters the results by a search string.
   *
   * @param params - The parameters for the search.
   * @param params.dir - The root directory to start the search from.
   * @param params.search - (Optional) A string to filter file paths. Only files whose full path includes this string will be included.
   * @param params.fileList - The accumulator array for found file paths. Defaults to an empty array.
   * @returns A promise that resolves to an array of file paths matching the search criteria.
   */
  searchFileIn = async ({
    dir,
    search,
    fileList = []
  }: {
    dir: string
    search?: string
    fileList: string[]
  }) => {
    const files = await readdir(dir)

    await Promises.map(files, async file => {
      const filepath = join(dir, file)
      const statFS = await stat(filepath)

      if (statFS.isDirectory()) {
        fileList = await this.searchFileIn({
          dir: filepath,
          fileList,
          search
        })
      } else {
        const fullPath = path.join(dir, file)
        if (search) {
          if (fullPath.includes(search)) {
            fileList.push(fullPath)
          }
        } else {
          fileList.push(fullPath)
        }
      }
    })

    return fileList
  }

  isGoatFolder = (): boolean => {
    const fastDirname = '.goat'
    return existsSync(fastDirname)
  }
}

export const Folders = new FoldersClass()
