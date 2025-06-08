import { Combination } from './Combinations'

describe('Combinations', () => {
  it('should create combinations of given size', () => {
    const c = new Combination([1, 2, 3], 2)
    const results = Array.from(c)
    expect(results).toEqual([
      [1, 2],
      [1, 3],
      [2, 3]
    ])
  })

  it('should return correct nth combination', () => {
    const c = new Combination(['a', 'b', 'c', 'd'], 2)
    expect(c.nth(0)).toEqual(['a', 'b'])
    expect(c.nth(5)).toEqual(['c', 'd'])
  })

  it('should handle empty combinations', () => {
    const c = new Combination([], 0)
    const results = Array.from(c)
    expect(results).toEqual([[]])
  })

  it('should return undefined for out of range nth', () => {
    const c = new Combination([1, 2], 2)
    expect(c.nth(10)).toBeUndefined()
  })

  it('should have correct size and length', () => {
    const c = new Combination([1, 2, 3], 2)
    expect(c.size).toBe(2)
    expect(c.length).toBe(3)
    expect(typeof c.size).toBe('number')
    expect(typeof c.length).toBe('number')
  })

  it('should return only one combination when size equals array length', () => {
    const c = new Combination([1, 2, 3], 3)
    const results = Array.from(c)
    expect(results).toEqual([[1, 2, 3]])
  })

  it('should return all elements as separate arrays when size is 1', () => {
    const c = new Combination([1, 2, 3], 1)
    const results = Array.from(c)
    expect(results).toEqual([[1], [2], [3]])
  })

  it('should support large arrays with small size', () => {
    const c = new Combination([1, 2, 3, 4, 5], 2)
    const results = Array.from(c)
    expect(results.length).toBe(10)
  })
})
