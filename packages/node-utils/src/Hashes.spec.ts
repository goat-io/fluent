import { Hashes } from './Hashes'

test('md5', () => {
  const plain = 'hello!@#123'
  const m = Hashes.md5(plain)
  expect(m).toBe('41f871086829ceb41c02d2f99e11ddd0')
})

test('md5Buffer', () => {
  const plain = 'hello!@#123'
  const m = Hashes.md5AsBuffer(plain)
  expect(m).toMatchInlineSnapshot(`
    Object {
      "data": Array [
        65,
        248,
        113,
        8,
        104,
        41,
        206,
        180,
        28,
        2,
        210,
        249,
        158,
        17,
        221,
        208,
      ],
      "type": "Buffer",
    }
  `)
})

test('base64', () => {
  const plain = 'hello!@#123'
  const enc = Hashes.stringToBase64(plain)
  expect(enc).toBe('aGVsbG8hQCMxMjM=')
  const dec = Hashes.base64ToString(enc)
  expect(dec).toBe(plain)
})
