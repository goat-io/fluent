// npx vitest run ./src/Folders.test.ts

import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Folders } from './Folders'

describe('FoldersClass', () => {
  const tmpDir = path.join(__dirname, '__test_tmp__')
  const testFile = path.join(tmpDir, 'file.txt')
  const subDir = path.join(tmpDir, 'sub')
  const subFile = path.join(subDir, 'subfile.txt')
  const tmpDir2 = path.join(__dirname, '__test_tmp2__')

  beforeEach(() => {
    Folders.removeSync(tmpDir)
    Folders.removeSync(tmpDir2)
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    Folders.removeSync(tmpDir)
    Folders.removeSync(tmpDir2)
    Folders.removeSync('.goat')
  })

  describe('findOrCreate', () => {
    it('creates the directory for a given file path if it does not exist', () => {
      const filePath = path.join(tmpDir, 'newdir', 'file.txt')
      expect(fs.existsSync(path.dirname(filePath))).toBe(false)
      Folders.findOrCreate(filePath)
      expect(fs.existsSync(path.dirname(filePath))).toBe(true)
      Folders.removeSync(path.dirname(filePath)) // Clean up
    })

    it('returns true if the directory already exists', () => {
      const filePath = path.join(tmpDir, 'file.txt')
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      expect(Folders.findOrCreate(filePath)).toBe(true)
      Folders.removeSync(filePath) // Clean u
    })
  })

  describe('removeSync', () => {
    it('removes a directory and all its contents', () => {
      fs.writeFileSync(testFile, 'hello')
      expect(fs.existsSync(tmpDir)).toBe(true)
      Folders.removeSync(tmpDir)
      expect(fs.existsSync(tmpDir)).toBe(false)
    })
  })

  describe('hash', () => {
    it('returns the same hash for identical directory contents', () => {
      fs.writeFileSync(testFile, 'abc')
      fs.mkdirSync(subDir)
      fs.writeFileSync(subFile, 'def')
      const hash1 = Folders.hash(tmpDir)
      // Recreate the same structure in another temp dir
      const tmpDir2 = path.join(__dirname, '__test_tmp2__')
      Folders.removeSync(tmpDir2)
      fs.mkdirSync(tmpDir2, { recursive: true })
      fs.writeFileSync(path.join(tmpDir2, 'file.txt'), 'abc')
      fs.mkdirSync(path.join(tmpDir2, 'sub'))
      fs.writeFileSync(path.join(tmpDir2, 'sub', 'subfile.txt'), 'def')
      const hash2 = Folders.hash(tmpDir2)
      expect(hash1).toBe(hash2)
      Folders.removeSync(tmpDir2) // Clean up
    })

    it('returns different hashes for different directory contents', () => {
      fs.writeFileSync(testFile, 'abc')
      const hash1 = Folders.hash(tmpDir)
      fs.writeFileSync(testFile, 'abcd')
      const hash2 = Folders.hash(tmpDir)
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('isGoatFolder', () => {
    it('returns true if .goat directory exists', () => {
      fs.mkdirSync('.goat')
      expect(Folders.isGoatFolder()).toBe(true)
    })

    it('returns false if .goat directory does not exist', () => {
      if (fs.existsSync('.goat')) {
        Folders.removeSync('.goat')
      }
      expect(Folders.isGoatFolder()).toBe(false)
    })
  })

  describe('searchFileIn', () => {
    beforeEach(() => {
      fs.mkdirSync(subDir, { recursive: true })
      fs.writeFileSync(testFile, 'root')
      fs.writeFileSync(subFile, 'sub')
    })

    it('finds all files recursively', async () => {
      const files = await Folders.searchFileIn({ dir: tmpDir, fileList: [] })
      expect(files.sort()).toEqual([testFile, subFile].sort())
    })

    it('filters files by search string', async () => {
      const files = await Folders.searchFileIn({
        dir: tmpDir,
        search: 'subfile',
        fileList: []
      })
      expect(files).toEqual([subFile])
    })

    it('returns empty array if no files match search', async () => {
      const files = await Folders.searchFileIn({
        dir: tmpDir,
        search: 'notfound',
        fileList: []
      })
      expect(files).toEqual([])
    })
  })
})
