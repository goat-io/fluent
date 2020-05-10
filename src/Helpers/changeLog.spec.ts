import { Changelog } from './ChangeLog'
test('Should get basic diffs', () => {
  const changelog = Changelog.get({
    previous: {},
    current: { id: '1' },
    author: 'cabrera'
  })
  expect(changelog[0].kind).toBe('NEW')
  expect(changelog[0].new).toBe('1')
  expect(changelog[0].path[0]).toBe('id')
  expect(changelog[0].previous).toBe('undefined')
  expect(changelog[0].user).toBe('cabrera')
})

test('Should get advanced diffs', () => {
  const changelog = Changelog.get({
    previous: {
      id: '1',
      data: {
        name: 'Pedro'
      }
    },
    current: {
      id: '1',
      data: {
        name: 'Jose'
      }
    },
    author: 'cabrera'
  })

  expect(changelog[0].kind).toBe('EDITED')
  expect(changelog[0].path[0]).toBe('data')
  expect(changelog[0].path[1]).toBe('name')
  expect(changelog[0].previous).toBe('Pedro')
  expect(changelog[0].new).toBe('Jose')
  expect(changelog[0].user).toBe('cabrera')
})

test('Should get advanced Array diffs', () => {
  const changelog = Changelog.get({
    previous: {
      id: '1',
      data: {
        name: 'Pedro',
        children: ['a', 'b']
      }
    },
    current: {
      id: '1',
      data: {
        name: 'Jose',
        children: ['a', 'b', 'c']
      }
    },
    author: 'cabrera'
  })
  expect(changelog[0].kind).toBe('EDITED')
  expect(changelog[1].kind).toBe('ARRAY-EDITED')
  expect(changelog[1].path[0]).toBe('data')
  expect(changelog[1].path[1]).toBe('children')
  expect(changelog[1].item.kind).toBe('NEW')
  expect(changelog[1].item.new).toBe('c')
})
