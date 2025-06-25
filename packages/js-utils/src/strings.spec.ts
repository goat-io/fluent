// npx jest -i ./src/strings.spec.ts

import { Strings } from './Strings'

const text = 'Search'
const generatedNgram = Strings.ngram(text)

it('Should all text after a given string', () => {
  const after = Strings.after('This is my name', 'This is')
  expect(after).toBe(' my name')
})

it('Should all text before a given string', () => {
  const after = Strings.before('This is my name', 'my name')
  expect(after).toBe('This is ')
})

it('Should get the camelCase of a string', () => {
  const camel = Strings.camel('foo_bar')
  expect(camel).toBe('fooBar')
})

it('Should get if contains a string', () => {
  const contains = Strings.contains('This is my name', 'my')
  expect(contains).toBe(true)
})

it('Should get if contains any from string array', () => {
  const contains = Strings.contains('This is my name', ['myasdf', '1234'])
  expect(contains).toBe(false)

  const containsTrue = Strings.contains('This is my name', ['myasdf', 'my'])
  expect(containsTrue).toBe(true)
})

it('Should limit a given string', () => {
  const limit = Strings.limit(
    'The quick brown fox jumps over the lazy dog',
    20,
    ' (...)'
  )
  expect(limit).toBe('The quick brown fox (...)')
})

it('Should generate a slug from a string', () => {
  const slug = Strings.slug('Laravel 5 Framework', '-')
  expect(slug).toBe('laravel-5-framework')
})

it('Should generate a snake_case string', () => {
  const snake = Strings.snake('fooBar')
  expect(snake).toBe('foo_bar')
})

// Additional tests for upperFirst
it('Should capitalize first letter', () => {
  expect(Strings.upperFirst('hello')).toBe('Hello')
  expect(Strings.upperFirst('')).toBe('')
  expect(Strings.upperFirst('a')).toBe('A')
})

// Additional tests for lowerFirst
it('Should lowercase first letter', () => {
  expect(Strings.lowerFirst('Hello')).toBe('hello')
  expect(Strings.lowerFirst('WORLD')).toBe('wORLD')
  expect(Strings.lowerFirst('a')).toBe('a')
})

// Additional tests for camel
it('Should handle complex camelCase conversions', () => {
  expect(Strings.camel('hello-world')).toBe('helloWorld')
  expect(Strings.camel('foo bar baz')).toBe('fooBarBaz')
  expect(Strings.camel("don't-stop")).toBe('dontStop')
  expect(Strings.camel('XML_HTTP_Request')).toBe('xmlHttpRequest')
})

// Additional tests for slug
it('Should handle complex slug generation', () => {
  expect(Strings.slug('Hello World!')).toBe('hello-world')
  expect(Strings.slug('Café & Restaurant', '_')).toBe('cafe_and_restaurant')
  expect(Strings.slug('Special chars: àáâäæãåā')).toBe('special-chars-aaaaaaaa')
  expect(Strings.slug('Multiple---dashes')).toBe('multiple-dashes')
  expect(Strings.slug('  Leading and trailing  ')).toBe('leading-and-trailing')
})

// Tests for kebabCase
it('Should convert to kebab-case', () => {
  expect(Strings.kebabCase('fooBar')).toBe('foo-bar')
  expect(Strings.kebabCase('foo_bar')).toBe('foo-bar')
  expect(Strings.kebabCase('FOO BAR')).toBe('foo-bar')
  expect(Strings.kebabCase('XMLHttpRequest')).toBe('xml-http-request')
})

// Tests for words
it('Should split string into words', () => {
  expect(Strings.words('fred, barney, & pebbles')).toEqual([
    'fred',
    'barney',
    'pebbles'
  ])
  expect(Strings.words('fooBar')).toEqual(['foo', 'Bar'])
  expect(Strings.words('XMLHttpRequest')).toEqual(['XML', 'Http', 'Request'])
  expect(Strings.words('hello world')).toEqual(['hello', 'world'])
  expect(Strings.words('fred, barney, & pebbles', /[^, ]+/g)).toEqual([
    'fred',
    'barney',
    '&',
    'pebbles'
  ])
})

// Tests for jsonParseIfPossible
it('Should parse JSON when possible', () => {
  expect(Strings.jsonParseIfPossible('{"name": "John"}')).toEqual({
    name: 'John'
  })
  expect(Strings.jsonParseIfPossible('[1, 2, 3]')).toEqual([1, 2, 3])
  expect(Strings.jsonParseIfPossible('123')).toBe(123)
  expect(Strings.jsonParseIfPossible('"hello"')).toBe('hello')
  expect(Strings.jsonParseIfPossible('not json')).toBe('not json')
  expect(Strings.jsonParseIfPossible('{"invalid": json}')).toBe(
    '{"invalid": json}'
  )
  expect(Strings.jsonParseIfPossible(null)).toBe(null)
  expect(Strings.jsonParseIfPossible(undefined)).toBe(undefined)
})

// Tests for capitalize
it('Should capitalize strings', () => {
  expect(Strings.capitalize('hello')).toBe('Hello')
  expect(Strings.capitalize('HELLO')).toBe('Hello')
  expect(Strings.capitalize('hELLO wORLD')).toBe('Hello world')
  expect(Strings.capitalize('')).toBe('')
  expect(Strings.capitalize()).toBe('')
})

// Tests for split
it('Should split with limit', () => {
  expect(Strings.split('a-b-c-d', '-', 2)).toEqual(['a', 'b-c-d'])
  expect(Strings.split('one,two,three,four', ',', 3)).toEqual([
    'one',
    'two',
    'three,four'
  ])
  expect(Strings.split('hello world', ' ', 1)).toEqual(['hello world'])
})

// Tests for removeWhitespace
it('Should remove all whitespace', () => {
  expect(Strings.removeWhitespace('hello world')).toBe('helloworld')
  expect(Strings.removeWhitespace('  a  b  c  ')).toBe('abc')
  expect(Strings.removeWhitespace('no\twhite\nspace')).toBe('nowhitespace')
})

// Tests for truncate
it('Should truncate strings', () => {
  expect(Strings.truncate('hello world', 5)).toBe('he...')
  expect(Strings.truncate('hello world', 5, '***')).toBe('he***')
  expect(Strings.truncate('hello', 10)).toBe('hello')
  expect(Strings.truncate('', 5)).toBe('')
})

// Tests for truncateMiddle
it('Should truncate from middle', () => {
  expect(Strings.truncateMiddle('hello world test', 10)).toBe('hell...est')
  expect(Strings.truncateMiddle('hello world test', 10, '***')).toBe(
    'hell***est'
  )
  expect(Strings.truncateMiddle('hello', 10)).toBe('hello')
  expect(Strings.truncateMiddle('', 5)).toBe('')
})

// Tests for substringBefore
it('Should get substring before delimiter', () => {
  expect(Strings.substringBefore('hello-world-test', '-')).toBe('hello')
  expect(Strings.substringBefore('no-delimiter', '|')).toBe('no-delimiter')
  expect(Strings.substringBefore('', '-')).toBe('')
})

// Tests for substringBeforeLast
it('Should get substring before last delimiter', () => {
  expect(Strings.substringBeforeLast('hello-world-test', '-')).toBe(
    'hello-world'
  )
  expect(Strings.substringBeforeLast('no-delimiter', '|')).toBe('no-delimiter')
  expect(Strings.substringBeforeLast('', '-')).toBe('')
})

// Tests for substringAfter
it('Should get substring after delimiter', () => {
  expect(Strings.substringAfter('hello-world-test', '-')).toBe('world-test')
  expect(Strings.substringAfter('no-delimiter', '|')).toBe('no-delimiter')
  expect(Strings.substringAfter('', '-')).toBe('')
})

// Tests for substringAfterLast
it('Should get substring after last delimiter', () => {
  expect(Strings.substringAfterLast('hello-world-test', '-')).toBe('test')
  expect(Strings.substringAfterLast('no-delimiter', '|')).toBe('no-delimiter')
  expect(Strings.substringAfterLast('', '-')).toBe('')
})

// Tests for substringBetweenLast
it('Should get substring between last left and first right delimiter', () => {
  expect(
    Strings.substringBetweenLast('/Users/lalala/someFile.test.ts', '/', '.')
  ).toBe('someFile')
  expect(Strings.substringBetweenLast('path/to/file.name.ext', '/', '.')).toBe(
    'file'
  )
  expect(Strings.substringBetweenLast('no-delimiters', '/', '.')).toBe(
    'no-delimiters'
  )
})

// Tests for replaceAll
it('Should replace all occurrences', () => {
  expect(Strings.replaceAll('hello world hello', 'hello', 'hi')).toBe(
    'hi world hi'
  )
  expect(Strings.replaceAll('test.test.test', '.', '-')).toBe('test-test-test')
  expect(Strings.replaceAll('no match', 'x', 'y')).toBe('no match')
})

// Tests for nl2br
it('Should convert newlines to br tags', () => {
  expect(Strings.nl2br('hello\nworld')).toBe('hello<br>\nworld')
  expect(Strings.nl2br('line1\nline2\nline3')).toBe(
    'line1<br>\nline2<br>\nline3'
  )
  expect(Strings.nl2br('no newlines')).toBe('no newlines')
})

// Tests for parseQueryString
it('Should parse query strings', () => {
  expect(Strings.parseQueryString('?name=John&age=30')).toEqual({
    name: 'John',
    age: '30'
  })
  expect(Strings.parseQueryString('name=John&age=30')).toEqual({
    name: 'John',
    age: '30'
  })
  expect(Strings.parseQueryString('key1=value1&key2=')).toEqual({
    key1: 'value1',
    key2: ''
  })
  expect(Strings.parseQueryString('encoded=%20space%20')).toEqual({
    encoded: ' space '
  })
  expect(Strings.parseQueryString('')).toEqual({})
  expect(Strings.parseQueryString('key')).toEqual({ key: '' })
})

// Additional edge case tests for after/before
it('Should handle edge cases for after/before', () => {
  expect(Strings.after('hello', 'notfound')).toBe('hello')
  expect(Strings.before('hello', 'notfound')).toBe('hello')
  expect(Strings.after('', 'search')).toBe('')
  expect(Strings.before('', 'search')).toBe('')
})

// Additional edge case tests for limit
it('Should handle edge cases for limit', () => {
  expect(Strings.limit('short', 100)).toBe('short...')
  expect(Strings.limit('', 10)).toBe('...')
  expect(Strings.limit('test', 0, '***')).toBe('***')
})

test('Undefined case', () => {
  const generatedNgram = Strings.ngram(undefined)
  expect(generatedNgram).toBe('')
})

test('Original text should not change', () => {
  expect(text).toBe('Search')
})

test('Should generate Ngram from Text', () => {
  expect(generatedNgram).toBe(
    'S Se Sea ear arc rch Sear earc arch Searc earch Search'
  )
})

test('Single character should return same character', () => {
  const text = 's'
  const generatedNgram = Strings.ngram(text)
  expect(generatedNgram).toBe('s')
})

test('Double character should return ngram', () => {
  const text = 'sa'
  const generatedNgram = Strings.ngram(text)
  expect(generatedNgram).toBe('s sa')
})

// Additional ngram tests
test('Should handle empty string in ngram', () => {
  expect(Strings.ngram('')).toBe('')
  expect(Strings.ngram('undefined ')).toBe('')
})

const simpleSubmission = {
  id: '12345asdasdf',
  data: {
    name: 'Pedro',
    lastName: 'Cabrera',
    rut: '14.434.545-1'
  }
}

const fuzzy = ['data.name', 'data.lastName']
const expectedNgram =
  'P Pe Ped edr dro Pedr edro Pedro C Ca Cab abr bre rer era Cabr abre brer rera Cabre abrer brera Cabrer abrera Cabrera'

test('Should Generate Ngram from array Submission', () => {
  const generatedNgram = Strings.ngramFromObject({
    fields: fuzzy,
    object: simpleSubmission
  })

  expect(generatedNgram).toBe(expectedNgram)
})

test('Should Generate Ngram from array', () => {
  const generatedNgram = Strings.ngramFromArray([
    simpleSubmission.data.name,
    simpleSubmission.data.lastName
  ])

  expect(generatedNgram).toBe(expectedNgram)
})

// Additional tests for ngramFromArray edge cases
test('Should handle empty array in ngramFromArray', () => {
  expect(Strings.ngramFromArray([])).toBe('')
})

test('Should handle array with empty strings in ngramFromArray', () => {
  expect(Strings.ngramFromArray(['', 'test'])).toContain('t te tes est test')
})

// Additional tests for ngramFromObject edge cases
test('Should handle missing fields in ngramFromObject', () => {
  const result = Strings.ngramFromObject({
    fields: ['data.nonexistent'],
    object: simpleSubmission
  })
  expect(result).toBe('')
})
