import { parse } from './parse'
import { SupportedFrameworks } from './parse'
import { BasicForms } from '../../Formio/validator/Logic/tests/Forms/BasicRelationsTest'

test('Should parse a single FormioForm', async () => {
  const countries = BasicForms.find((f) => f.path === 'countries')
  const result = await parse(countries, SupportedFrameworks.Loopback)
  expect(result[0].model._id).toBe('5cf99eb190d44a00189ab94f')
  expect(result[0].model.folderPath).toBe('countries')
  expect(result[0].modules.file).toBe('export const modules = [\n  "core",\n  "countries" \n];')
})
