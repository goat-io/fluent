/*
import { Client, expect } from '@loopback/testlab'
import { LoobackConnectorApplication } from '../../../../../../limelight/Loopback/src'
import { setupApplication } from '../../../../../../limelight/Loopback/src/__tests__/test-helper'
const exampleForm = require('../../__tests__/Forms/BasicRelationsTest')()


describe('Insert Forms', () => {
  let app: LoobackConnectorApplication
  let client: Client

  before('setupApplication', async () => {
    ;({ app, client } = await setupApplication())
  })

  after(async () => {
    await app.stop()
  })

  it('[API] Should start with no forms', async () => {
    const res = await client.get('/forms').expect(200)
    expect(res.body.length).to.be.equal(0)
  })

  it('[API] Should not insert empty form', async () => {
    const res = await client
      .post('/forms')
      .send({})
      .expect(422)

    expect(res.body.error.name).to.equal('UnprocessableEntityError')
  })

  it('[API] Should create Form', async () => {
    let countries = exampleForm.find((f: { path: string }) => f.path === 'countries')

    countries.id = undefined
    countries.owner = undefined
    countries.deleted = 0
    countries.components = JSON.stringify(countries.components)
    const res = await client
      .post('/forms')
      .send(countries)
      .expect(200)
  })

  it('[API] Should get Form', async () => {
    const res = await client.get('/forms').expect(200)
    expect(Array.isArray(res.body)).to.equal(true)
    expect(res.body[0]).to.containEql({
      type: 'resource',
      path: 'countries'
    })
    expect(typeof res.body[0].id).to.equal('undefined')
    expect(typeof res.body[0].id).to.equal('string')
  })

  let testId: string

  it('[API] Should create MANY Forms', async () => {
    let products = exampleForm.find((f: { path: string }) => f.path === 'specifications')
    let providers = exampleForm.find((f: { path: string }) => f.path === 'providers')
    products.id = undefined
    products.owner = undefined
    products.deleted = 0
    products.components = JSON.stringify(products.components)

    providers.id = undefined
    providers.owner = undefined
    providers.deleted = 0
    providers.components = JSON.stringify(providers.components)

    const res = await client
      .post('/forms/createMany')
      .send([products, providers])
      .expect(200)

    expect(res.body.length).to.equal(2)
    expect(typeof res.body[0].id).to.equal('undefined')
    expect(typeof res.body[0].id).to.equal('string')
    expect(res.body[0].path).to.equal('specifications')
    testId = res.body[0].id
  })

  it('Should get a form by id', async () => {
    const url = `/forms/${testId}`.trim()
    const res = await client.get(url).expect(200)
    expect(res.body.id).to.equal(testId)
  })
})
*/
