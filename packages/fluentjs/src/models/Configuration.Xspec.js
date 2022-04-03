/* global describe, it, before */
import 'babel-polyfill'
import chai from 'chai'

import Configutation from './Configuration'
import Form from './Form'
chai.expect()
const expect = chai.expect

describe('Given a FLUENT Local Model', async () => {
  it('Should get the remote configuration', async () => {
    let config = await Configutation.remote().first()

    expect(config.data.project).to.be.equal('GOAT')
  })

  it('Should get the local configuration', async () => {
    let config = await Configutation.local().first()

    expect(config.project).to.be.equal('GOAT')
  })

  it('Should load the Forms', async () => {
    let form = await Form.remote().select('type').limit(1).get()

    expect(form[0].type).to.be.equal('resource')
  })
})
