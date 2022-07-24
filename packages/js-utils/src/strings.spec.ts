import { Strings } from './Strings'

const text = 'Search'
const generatedNgram = Strings.ngram(text)

it('Should get the singular of a word', () => {
  const plural = 'dogs'
  const singular = Strings.singular(plural)
  expect(singular).toBe('dog')
})

it('Should get the plural of a word', () => {
  const singular = 'child'
  const plural = Strings.plural(singular)
  expect(plural).toBe('children')
})

it('Should get the singular given the count', () => {
  const singular = 'child'
  const plural = Strings.plural(singular, 1)
  expect(plural).toBe('child')
})

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
