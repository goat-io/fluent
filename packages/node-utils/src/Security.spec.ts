// npx jest -i ./src/Security.spec.ts
import { Security } from './Security'

it('Should generate Eliptic Curve Keys', async () => {
  const curve = await Security.generateElipticCurve()

  expect(typeof curve.privateKey).toBe('string')
  expect(typeof curve.publicKey).toBe('string')
})

it('Keys should be able to sign and decode', async () => {
  const curve = await Security.generateElipticCurve()

  const message = 'THIS IS A SECRET MESSAGE'

  const encrypted = Security.encryptStringWithElliptic(
    message,
    curve.privateKey
  )

  const verified = Security.verifySignedStringWithElliptic(
    message,
    encrypted,
    curve.publicKey
  )

  const falseVerify = Security.verifySignedStringWithElliptic(
    'THIS IS A SECRET MESSAGE2',
    encrypted,
    curve.publicKey
  )

  expect(typeof encrypted).toBe('string')
  expect(verified).toBe(true)
  expect(falseVerify).toBe(false)
})

it('Should generate a password', async () => {
  const password = Security.generatePassword(40)

  expect(typeof password).toBe('string')
  expect(password.length).toBe(40)
})
