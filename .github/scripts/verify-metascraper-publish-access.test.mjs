import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyPublishAccess } from './verify-metascraper-publish-access.mjs'

test('only exact-package write access permits publication without printing identities', () => {
  const calls = []
  const messages = []
  const result = verifyPublishAccess({
    token: 'test-only',
    log: value => messages.push(value),
    run: args => {
      calls.push(args)
      return {
        status: 0,
        stdout:
          args[0] === 'whoami'
            ? 'private-identity'
            : JSON.stringify({
                '@goatlab/node-metascraper': 'read-write',
                'private-package': 'read-write',
              }),
      }
    },
  })
  assert.equal(result, true)
  assert.deepEqual(
    calls.map(args => args.slice(0, 3)),
    [
      ['whoami', '--json', '--registry=https://registry.npmjs.org'],
      ['access', 'list', 'packages'],
    ],
  )
  assert.deepEqual(messages, [
    'npmPublishAccess {"tokenPresent":true,"authenticationSuccess":true,"accessLookupSuccess":true,"exactPackageWrite":true}',
  ])
})

test('missing token and failed authentication stop before access lookup', () => {
  for (const token of ['', 'test-only']) {
    let calls = 0
    const messages = []
    assert.equal(
      verifyPublishAccess({
        token,
        log: value => messages.push(value),
        run: () => {
          calls++
          throw new Error('private credential detail')
        },
      }),
      false,
    )
    assert.equal(calls, token ? 1 : 0)
    assert.equal(messages.length, 1)
    assert.equal(messages[0].includes('private'), false)
    assert.equal(messages[0].includes('"authenticationSuccess":false'), true)
  }
})

test('read-only, unrelated, malformed and failed access results fail closed', () => {
  for (const access of [
    { status: 0, stdout: '{"@goatlab/node-metascraper":"read-only"}' },
    { status: 0, stdout: '{"unrelated":"read-write"}' },
    { status: 0, stdout: 'private invalid output' },
    { status: 1, stdout: '{"@goatlab/node-metascraper":"read-write"}' },
    { status: 0, stdout: 'null' },
  ]) {
    let calls = 0
    const messages = []
    assert.equal(
      verifyPublishAccess({
        token: 'test-only',
        log: value => messages.push(value),
        run: () => (++calls === 1 ? { status: 0 } : access),
      }),
      false,
    )
    const result = JSON.parse(messages[0].slice('npmPublishAccess '.length))
    assert.equal(result.exactPackageWrite, false)
    assert.equal(
      result.accessLookupSuccess,
      access.status === 0 && access.stdout.startsWith('{'),
    )
  }
})
