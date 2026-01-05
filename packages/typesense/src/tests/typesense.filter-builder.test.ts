// npx vitest run ./src/services/search/typesense/tests/typesense.filter-builder.test.ts

import { describe, expect, it } from 'vitest'
import { filterBuilder } from '../components/typesense.filter-builder'

describe('TypesenseFilterBuilder', () => {
  it('should create equality filters', () => {
    const filter = filterBuilder().equals('status', 'active').build()

    expect(filter).toBe('status:="active"')
  })

  it('should create not-equals filters', () => {
    const filter = filterBuilder().notEquals('status', 'deleted').build()

    expect(filter).toBe('status:!="deleted"')
  })

  it('should create IN filters', () => {
    const filter = filterBuilder()
      .in('category', ['electronics', 'books', 'clothing'])
      .build()

    expect(filter).toBe('category:=["electronics", "books", "clothing"]')
  })

  it('should create NOT IN filters', () => {
    const filter = filterBuilder()
      .notIn('status', ['deleted', 'archived'])
      .build()

    expect(filter).toBe('status:!=["deleted", "archived"]')
  })

  it('should create numeric comparison filters', () => {
    const filter = filterBuilder()
      .greaterThan('price', 100)
      .lessThanOrEqual('stock', 50)
      .build()

    expect(filter).toBe('price:>100 && stock:<=50')
  })

  it('should create range filters', () => {
    const filter = filterBuilder().range('price', 10, 100).build()

    expect(filter).toBe('price:>=10 && price:<=100')
  })

  it('should create string pattern filters', () => {
    const filter = filterBuilder().contains('title', 'typescript').build()

    expect(filter).toBe('title:*"typescript"*')
  })

  it('should create starts with filters', () => {
    const filter = filterBuilder().startsWith('name', 'John').build()

    expect(filter).toBe('name:"John"*')
  })

  it('should create ends with filters', () => {
    const filter = filterBuilder().endsWith('email', '@example.com').build()

    expect(filter).toBe('email:*"@example.com"')
  })

  it('should create exists/not exists filters', () => {
    const filter = filterBuilder()
      .exists('description')
      .notExists('deleted_at')
      .build()

    expect(filter).toBe('description:!=null && deleted_at:=null')
  })

  it('should chain multiple filters with AND', () => {
    const filter = filterBuilder()
      .equals('status', 'active')
      .greaterThan('price', 50)
      .in('category', ['books', 'electronics'])
      .build()

    expect(filter).toBe(
      'status:="active" && price:>50 && category:=["books", "electronics"]',
    )
  })

  it('should handle grouped AND filters', () => {
    const filter = filterBuilder()
      .equals('status', 'active')
      .and(builder => {
        builder.greaterThan('price', 100).lessThan('price', 500)
      })
      .build()

    expect(filter).toBe('status:="active" && (price:>100 && price:<500)')
  })

  it('should handle grouped OR filters', () => {
    const filter = filterBuilder()
      .equals('status', 'active')
      .or(builder => {
        builder
          .equals('category', 'electronics')
          .equals('category', 'computers')
      })
      .build()

    expect(filter).toBe(
      'status:="active" && (category:="electronics" || category:="computers")',
    )
  })

  it('should handle complex nested filters', () => {
    const filter = filterBuilder()
      .equals('published', true)
      .or(builder => {
        builder
          .and(sub => {
            sub.equals('category', 'electronics').greaterThan('price', 100)
          })
          .and(sub => {
            sub.equals('category', 'books').greaterThan('rating', 4)
          })
      })
      .build()

    expect(filter).toBe(
      'published:=true && ((category:="electronics" && price:>100) || (category:="books" && rating:>4))',
    )
  })

  it('should escape string values with quotes', () => {
    const filter = filterBuilder().equals('title', 'Book with "quotes"').build()

    expect(filter).toBe('title:="Book with \\"quotes\\""')
  })

  it('should escape string values with backslashes', () => {
    const filter = filterBuilder()
      .equals('path', 'C:\\Users\\Documents')
      .build()

    expect(filter).toBe('path:="C:\\\\Users\\\\Documents"')
  })

  it('should handle numeric values', () => {
    const filter = filterBuilder()
      .equals('count', 42)
      .equals('price', 19.99)
      .build()

    expect(filter).toBe('count:=42 && price:=19.99')
  })

  it('should handle boolean values', () => {
    const filter = filterBuilder()
      .equals('active', true)
      .equals('deleted', false)
      .build()

    expect(filter).toBe('active:=true && deleted:=false')
  })

  it('should allow raw expressions', () => {
    const filter = filterBuilder()
      .equals('status', 'active')
      .raw('custom_field:~"pattern"')
      .build()

    expect(filter).toBe('status:="active" && custom_field:~"pattern"')
  })

  it('should reset the builder', () => {
    const builder = filterBuilder()
      .equals('status', 'active')
      .reset()
      .equals('category', 'books')

    expect(builder.build()).toBe('category:="books"')
  })

  it('should return empty string for empty filters', () => {
    const filter = filterBuilder().build()

    expect(filter).toBe('')
  })

  it('should validate field names', () => {
    expect(() => {
      filterBuilder().equals('invalid-field', 'value')
    }).toThrow('Invalid field name: invalid-field')

    expect(() => {
      filterBuilder().equals('123field', 'value')
    }).toThrow('Invalid field name: 123field')

    expect(() => {
      filterBuilder().equals('field with spaces', 'value')
    }).toThrow('Invalid field name: field with spaces')
  })

  it('should allow valid field names', () => {
    const filter = filterBuilder()
      .equals('valid_field', 'value')
      .equals('_underscore', 'value')
      .equals('field123', 'value')
      .equals('camelCase', 'value')
      .build()

    expect(filter).toBeTruthy()
  })

  it('should handle empty arrays in IN filters', () => {
    const filter = filterBuilder().in('category', []).build()

    expect(filter).toBe('category:=[]')
  })

  it('should handle numeric arrays in IN filters', () => {
    const filter = filterBuilder().in('ids', [1, 2, 3, 4, 5]).build()

    expect(filter).toBe('ids:=[1, 2, 3, 4, 5]')
  })

  it('should handle complex real-world scenarios', () => {
    // E-commerce product filter
    const filter = filterBuilder()
      .equals('status', 'active')
      .in('category', ['electronics', 'computers'])
      .range('price', 100, 1000)
      .greaterThanOrEqual('rating', 4)
      .exists('description')
      .or(builder => {
        builder
          .equals('brand', 'Apple')
          .equals('brand', 'Samsung')
          .equals('brand', 'Sony')
      })
      .build()

    const expected =
      'status:="active" && category:=["electronics", "computers"] && ' +
      'price:>=100 && price:<=1000 && rating:>=4 && description:!=null && ' +
      '(brand:="Apple" || brand:="Samsung" || brand:="Sony")'

    expect(filter).toBe(expected)
  })
})
