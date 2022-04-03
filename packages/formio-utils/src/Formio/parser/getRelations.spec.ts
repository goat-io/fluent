import { getRelations } from './getRelations'

import { AdvancedForm } from '../validator/Logic/tests/Forms/AdvancedRelationsTest'
import { BasicForms } from '../validator/Logic/tests/Forms/BasicRelationsTest'
import { MultiplePivots } from '../validator/Logic/tests/Forms/MultiplePivots'

const relations: any = getRelations(BasicForms)
const advancedRelations: any = getRelations(AdvancedForm)
const MultiplePivotsRelations: any = getRelations(MultiplePivots)

test('Should parse BelongsTo Relation', () => {
  expect(relations).toHaveProperty('products')
  expect(relations).toHaveProperty('countries')
  expect(relations.products[0].name).toBe('countries')
  expect(relations.products[0].type).toBe('belongsTo')
})

test('Should parse HasMany Relation', () => {
  expect(relations).toHaveProperty('products')
  expect(relations).toHaveProperty('countries')
  expect(relations.countries[0].name).toBe('providers')
  expect(relations.countries[0].type).toBe('hasMany')
})

test('Should parse BelongsToMany Relation', () => {
  expect(relations).toHaveProperty('providers')
  expect(relations).toHaveProperty('countries')
  expect(relations.providers[2].name).toBe('providers_specifications_countries')
  expect(relations.providers[2].type).toBe('belongsToMany')
})

test('Should parse BelongsToMany (inverse) Relation', () => {
  expect(relations).toHaveProperty('providers')
  expect(relations).toHaveProperty('countries')
  expect(relations.countries[3].name).toBe('countries_specifications_providers')
  expect(relations.countries[3].type).toBe('belongsToMany')
})

test('Should parse Advance relations', () => {
  expect(advancedRelations).toHaveProperty('order1n')
  expect(advancedRelations).toHaveProperty('customer1n')
  expect(advancedRelations).toHaveProperty('customer1nembedded')
  expect(advancedRelations).toHaveProperty('order1nembedded')
  expect(advancedRelations).toHaveProperty('customer1nembeddeddg')
  expect(advancedRelations).toHaveProperty('ordersnm')
  expect(advancedRelations).toHaveProperty('usersnm')
  expect(advancedRelations).toHaveProperty('productsnm')
})

test('Should parse 1N relation', () => {
  expect(advancedRelations).toHaveProperty('order1n')
  expect(advancedRelations).toHaveProperty('customer1n')
  expect(advancedRelations.order1n[0].name).toBe('customer1n')
  expect(advancedRelations.order1n[0].type).toBe('belongsTo')
})

test('Should parse inverse 1N relation', () => {
  expect(advancedRelations).toHaveProperty('order1n')
  expect(advancedRelations).toHaveProperty('customer1n')
  expect(advancedRelations.customer1n[0].name).toBe('order1n')
  expect(advancedRelations.customer1n[0].type).toBe('hasMany')
})

test('Should parse 1N EMBEDED relation', () => {
  expect(advancedRelations).toHaveProperty('customer1nembedded')
  expect(advancedRelations).toHaveProperty('order1nembedded')
  expect(advancedRelations.customer1nembedded[0].name).toBe('order1nembedded')
  expect(advancedRelations.customer1nembedded[0].type).toBe('EmbedsMany')
})

test('Should parse 1N EMBEDED inverse relation', () => {
  expect(advancedRelations).toHaveProperty('customer1nembedded')
  expect(advancedRelations).toHaveProperty('order1nembedded')
  expect(advancedRelations.order1nembedded[0].name).toBe('customer1nembedded')
  expect(advancedRelations.order1nembedded[0].type).toBe('hasManyEmbeded')
})

test('Should parse 1N DataGrid EMBEDED relation', () => {
  expect(advancedRelations).toHaveProperty('customer1nembeddeddg')
  expect(advancedRelations).toHaveProperty('order1nembedded')
  expect(advancedRelations.customer1nembeddeddg[0].name).toBe('order1nembedded')
  expect(advancedRelations.customer1nembeddeddg[0].type).toBe('EmbedsManyDG')
})

test('Should parse 1N DataGrid EMBEDED inverse relation', () => {
  expect(advancedRelations).toHaveProperty('customer1nembeddeddg')
  expect(advancedRelations).toHaveProperty('order1nembedded')
  expect(advancedRelations.order1nembedded[1].name).toBe('customer1nembeddeddg')
  expect(advancedRelations.order1nembedded[1].type).toBe('hasManyEmbededDG')
})

test('Should parse NM relations', () => {
  expect(advancedRelations).toHaveProperty('ordersnm')
  expect(advancedRelations).toHaveProperty('usersnm')
  expect(advancedRelations).toHaveProperty('productsnm')
})

test('Should parse NM relations - 1N left', () => {
  expect(advancedRelations).toHaveProperty('usersnm')
  expect(advancedRelations.usersnm[0].name).toBe('ordersnm')
  expect(advancedRelations.usersnm[0].type).toBe('hasMany')
})

test('Should parse NM relations - 1N left inverse', () => {
  expect(advancedRelations).toHaveProperty('ordersnm')
  expect(advancedRelations.ordersnm[0].name).toBe('usersnm')
  expect(advancedRelations.ordersnm[0].type).toBe('belongsTo')
})

test('Should parse NM relations - 1N right', () => {
  expect(advancedRelations).toHaveProperty('productsnm')
  expect(advancedRelations.productsnm[0].name).toBe('ordersnm')
  expect(advancedRelations.productsnm[0].type).toBe('hasMany')
})

test('Should parse NM relations - 1N right inverse', () => {
  expect(advancedRelations).toHaveProperty('ordersnm')
  expect(advancedRelations.ordersnm[1].name).toBe('productsnm')
  expect(advancedRelations.ordersnm[1].type).toBe('belongsTo')
})

test('Should parse NM relations - NM', () => {
  expect(advancedRelations).toHaveProperty('usersnm')
  expect(advancedRelations.usersnm[1].name).toBe('usersnm_ordersnm_productsnm')
  expect(advancedRelations.usersnm[1].type).toBe('belongsToMany')
  expect(advancedRelations.usersnm[1].pivotTable).toBe('ordersnm')
})

test('Should parse NM relations - NM inverse', () => {
  expect(advancedRelations).toHaveProperty('productsnm')
  expect(advancedRelations.productsnm[1].name).toBe(
    'productsnm_ordersnm_usersnm'
  )
  expect(advancedRelations.productsnm[1].type).toBe('belongsToMany')
  expect(advancedRelations.productsnm[1].pivotTable).toBe('ordersnm')
})

test('Should parse multiple NM relations', () => {
  expect(MultiplePivotsRelations).toHaveProperty('jobpositions')
  expect(MultiplePivotsRelations.jobpositions[1].name).toBe(
    'jobpositions_classification_company'
  )
  expect(MultiplePivotsRelations.jobpositions[1].type).toBe('belongsToMany')
  expect(MultiplePivotsRelations.jobpositions[1].pivotTable).toBe(
    'classification'
  )

  expect(MultiplePivotsRelations.jobpositions[2].name).toBe(
    'jobpositions_classification_industries'
  )
  expect(MultiplePivotsRelations.jobpositions[2].type).toBe('belongsToMany')
  expect(MultiplePivotsRelations.jobpositions[2].pivotTable).toBe(
    'classification'
  )
})
