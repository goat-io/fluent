import { Promises } from '@goatlab/js-utils'
import { Jwt } from './Jwt'

const validJWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7Il9pZCI6IjVjNzQxZWFiNzY1MDU1MDAxODMyYWVmMSJ9LCJmb3JtIjp7Il9pZCI6IjVjNzAyNGJiM2EzNjkzMDAxOGY0ZjQ2NCJ9LCJpYXQiOjE1Njg3NDUzMzIsImV4cCI6MTU2ODc1OTczMn0.LtD4j-AuU7TQX_fbbB85P_2mWEcCYZfRwGKdibJvKG8'
const validSecret = 'CHANGEME'

const decodedJWT = {
  id: '5c741eab765055001832aef1',
  name: 'SomeName',
  email: 'SomeEmail',
  roles: ['role1', 'role2']
}

test('Should verify a malformed token', async () => {
  const token = 'abvdcdv.1231,31231231'
  const [error, decoded] = await Promises.try(Jwt.verify(token, validSecret))
  expect(typeof decoded).toBe('undefined')
  expect(typeof error).toBe('object')
  expect(error?.name).toBe('JsonWebTokenError')
})

test('Should fail with invalid signature', async () => {
  const secret = 'ME'
  const [error] = await Promises.try(Jwt.verify(validJWT, secret))
  expect(error?.name).toBe('JsonWebTokenError')
})

test('Should verify DATE on valid JWT HS256', async () => {
  const [error] = await Promises.try(Jwt.verify(validJWT, validSecret))
  expect(error?.name).toBe('TokenExpiredError')
})

test('Should encode a payload JWT HS256', async () => {
  const token = await Jwt.generate(decodedJWT, {
    secret: validSecret,
    expiresIn: '2 days'
  })

  expect(typeof token).toBe('string')
  expect(token.includes('.')).toBe(true)
})

test('Should verify a valid JWT token HS256', async () => {
  const SignedPayload = await Jwt.generate(decodedJWT, {
    secret: validSecret,
    expiresIn: '1 year'
  })

  const [error, decoded] = await Promises.try(
    Jwt.verify(SignedPayload, validSecret)
  )
  expect(error).toBe(null)
  expect(decoded['id']).toBe('5c741eab765055001832aef1')
})
