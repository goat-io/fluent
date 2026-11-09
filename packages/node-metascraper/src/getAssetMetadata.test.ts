// pnpm --filter @goatlab/node-metascraper test src/getAssetMetadata.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAssetMetadata } from './getAssetMetadata.js'

const m = vi.hoisted(() => ({ fetch: vi.fn(), read: vi.fn(), stat: vi.fn() }))
vi.mock('./publicFetch.js', () => ({ publicFetch: m.fetch }))
vi.mock('node:fs/promises', () => ({ readFile: m.read, stat: m.stat }))
const png = () =>
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jqAAAAABJRU5ErkJggg==',
    'base64',
  )
beforeEach(() => {
  vi.clearAllMocks()
  m.fetch.mockResolvedValue({
    body: png(),
    headers: { 'content-type': 'image/png' },
  })
})
describe('bounded remote asset metadata', () => {
  it.each(['/etc/passwd', 'file:///etc/passwd', 'data:image/png;base64,aaa'])(
    'rejects metadata local path %s without reading files',
    async value => {
      await expect(getAssetMetadata(value)).rejects.toThrow(/opt-in/)
      expect(m.read).not.toHaveBeenCalled()
      expect(m.stat).not.toHaveBeenCalled()
      expect(m.fetch).not.toHaveBeenCalled()
    },
  )
  it('uses guarded fetch and header dimensions without bitmap decoding', async () => {
    const result = await getAssetMetadata('https://cdn.example.org/photo.png')
    expect(m.fetch).toHaveBeenCalledWith('https://cdn.example.org/photo.png', {
      maxBytes: 8 * 1024 * 1024,
    })
    expect(result).toMatchObject({
      width: 1,
      height: 1,
      isImage: true,
      mimeType: 'image/png',
    })
    expect(m.read).not.toHaveBeenCalled()
  })
  it('rejects excessive image dimensions before allocating a bitmap', async () => {
    const buffer = png()
    buffer.writeUInt32BE(100000, 16)
    m.fetch.mockResolvedValue({
      body: buffer,
      headers: { 'content-type': 'image/png' },
    })
    await expect(
      getAssetMetadata('https://cdn.example.org/bomb.png'),
    ).rejects.toThrow(/dimensions/)
  })
  it('retains local metadata only under explicit trusted-caller opt-in', async () => {
    m.stat.mockResolvedValue({ size: png().length })
    m.read.mockResolvedValue(png())
    expect(
      await getAssetMetadata('/trusted/photo.png', { allowLocalFiles: true }),
    ).toMatchObject({ width: 1 })
  })
})
