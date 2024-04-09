// yarn test changeLog.spec.ts

import { Changelogs, ChangeType } from './Changelogs'

describe('Changelogs', () => {
  const author = 'TestAuthor'

  test('should return an empty array when there are no changes', () => {
    const previous = { a: 1, b: { c: 2 } }
    const current = { a: 1, b: { c: 2 } }
    const changes = Changelogs.get({ previous, current, author })
    expect(changes).toEqual([])
  })

  test('should detect addition of a new property', () => {
    const previous = { a: 1 }
    const current = { a: 1, b: 2 }
    const changes = Changelogs.get({ previous, current, author })
    expect(changes).toEqual([
      {
        kind: ChangeType.NEW,
        path: ['b'],
        author: author,
        timestamp: expect.any(String),
        new: '2'
      }
    ])
  })

  test('should detect deletion of an existing property', () => {
    const previous = { a: 1, b: 2 }
    const current = { a: 1 }
    const changes = Changelogs.get({ previous, current, author })
    expect(changes).toEqual([
      {
        kind: ChangeType.DELETED,
        path: ['b'],
        author: author,
        timestamp: expect.any(String),
        previous: '2'
      }
    ])
  })

  test('should detect modification of an existing property', () => {
    const previous = { a: 1 }
    const current = { a: 2 }
    const changes = Changelogs.get({ previous, current, author })
    expect(changes).toEqual([
      {
        kind: ChangeType.EDITED,
        path: ['a'],
        author: author,
        timestamp: expect.any(String),
        previous: '1',
        new: '2'
      }
    ])
  })

  test('should handle nested object changes', () => {
    const previous = { a: 1, b: { c: 2 } }
    const current = { a: 1, b: { c: 3 } }
    const changes = Changelogs.get({ previous, current, author })
    expect(changes).toEqual([
      {
        kind: ChangeType.EDITED,
        path: ['b', 'c'],
        author: author,
        timestamp: expect.any(String),
        previous: '2',
        new: '3'
      }
    ])
  })

  test('should detect changes in arrays', () => {
    const previous = { a: [1, 2] }
    const current = { a: [2, 3] }
    const changes = Changelogs.get({ previous, current, author })
    expect(changes.length).toBe(2)
    expect(changes).toContainEqual({
      kind: ChangeType.EDITED,
      path: ['a', '0'],
      author: author,
      timestamp: expect.any(String),
      previous: '1',
      new: '2'
    })
    expect(changes).toContainEqual({
      kind: ChangeType.EDITED,
      path: ['a', '1'],
      author: author,
      timestamp: expect.any(String),
      previous: '2',
      new: '3'
    })
  })

  describe('Advanced Changelogs', () => {
    test('Should get advanced diffs', () => {
      const changelog = Changelogs.get({
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

      expect(changelog.length).toBe(1)
      expect(changelog[0].kind).toBe(ChangeType.EDITED)
      expect(changelog[0].path).toEqual(['data', 'name'])
      expect(changelog[0].previous).toBe('"Pedro"')
      expect(changelog[0].new).toBe('"Jose"')
      expect(changelog[0].author).toBe('cabrera')
    })

    test('Should get advanced Array diffs', () => {
      const changelog = Changelogs.get({
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

      // Checks for the edited name
      expect(changelog[0].kind).toBe(ChangeType.EDITED)
      expect(changelog[0].path).toEqual(['data', 'name'])
      expect(changelog[0].previous).toBe('"Pedro"')
      expect(changelog[0].new).toBe('"Jose"')

      // Checks for the added array item
      expect(changelog[1].kind).toBe(ChangeType.NEW)
      expect(changelog[1].path).toEqual(['data', 'children', '2'])
      expect(changelog[1].previous).toBeUndefined()
      expect(changelog[1].new).toBe('"c"')
    })

    test('Should handle intricate object and array diffs', () => {
      const previous = {
        id: '1',
        author: {
          name: 'John',
          age: 30,
          emails: ['john@example.com', 'john.doe@example.com'],
          address: {
            city: 'New York',
            zip: '10001'
          }
        },
        tags: ['developer', 'tester', 'admin']
      }

      const current = {
        id: '1',
        author: {
          name: 'John Doe',
          age: 31,
          emails: ['john.doe@example.com'],
          address: {
            city: 'Los Angeles',
            zip: '90001',
            country: 'USA'
          }
        },
        tags: ['developer', 'admin'],
        status: 'active'
      }

      const changelog = Changelogs.get({ previous, current, author: 'cabrera' })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['author', 'name'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify('John'),
        new: JSON.stringify('John Doe')
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['author', 'age'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify(30),
        new: JSON.stringify(31)
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['author', 'emails', '0'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify('john@example.com'),
        new: JSON.stringify('john.doe@example.com')
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.DELETED,
        path: ['author', 'emails', '1'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify('john.doe@example.com')
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['author', 'address', 'city'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify('New York'),
        new: JSON.stringify('Los Angeles')
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['author', 'address', 'zip'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify('10001'),
        new: JSON.stringify('90001')
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.NEW,
        path: ['author', 'address', 'country'],
        author: 'cabrera',
        timestamp: expect.any(String),
        new: JSON.stringify('USA')
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['tags', '1'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify('tester'),
        new: JSON.stringify('admin')
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.DELETED,
        path: ['tags', '2'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify('admin')
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.NEW,
        path: ['status'],
        author: 'cabrera',
        timestamp: expect.any(String),
        new: JSON.stringify('active')
      })
    })

    test('Should handle nulls, zeros, undefined, false, and true correctly', () => {
      const previous = {
        id: '1',
        isActive: false,
        count: 0,
        description: null,
        author: {
          verified: false,
          age: undefined,
          score: 0
        },
        tags: ['active', null, 'available']
      }

      const current = {
        id: '1',
        isActive: true,
        count: 10,
        description: 'A description',
        author: {
          verified: true,
          age: 25,
          score: null
        },
        tags: ['active', 'inactive', undefined]
      }

      const changelog = Changelogs.get({ previous, current, author: 'cabrera' })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['isActive'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify(false),
        new: JSON.stringify(true)
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['count'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify(0),
        new: JSON.stringify(10)
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['description'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify(null),
        new: JSON.stringify('A description')
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['author', 'verified'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify(false),
        new: JSON.stringify(true)
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['author', 'age'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify(undefined),
        new: JSON.stringify(25)
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['author', 'score'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify(0),
        new: JSON.stringify(null)
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['tags', '1'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify(null),
        new: JSON.stringify('inactive')
      })

      expect(changelog).toContainEqual({
        kind: ChangeType.EDITED,
        path: ['tags', '2'],
        author: 'cabrera',
        timestamp: expect.any(String),
        previous: JSON.stringify('available'),
        new: JSON.stringify(undefined)
      })
    })
  })
})
