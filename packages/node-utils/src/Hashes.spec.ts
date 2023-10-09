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
    {
      "data": [
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
it('should generate a hashed password with the correct salt', async () => {
  const password = 'my-password'
  const rounds = 10
  const hashedPassword = await Hashes.saltHash(password, rounds)

  expect(hashedPassword).toMatch(/\$2[aby]?\$[\d]{1,2}\$[.\/A-Za-z0-9]{53}/)
})

it('should correctly compare two hashed passwords', async () => {
  const password = 'my-password'
  const rounds = 10
  const hashedPassword = await Hashes.saltHash(password, rounds)

  expect(await Hashes.saltCompare(password, hashedPassword)).toBe(true)
  expect(await Hashes.saltCompare('wrong-password', hashedPassword)).toBe(false)
})
