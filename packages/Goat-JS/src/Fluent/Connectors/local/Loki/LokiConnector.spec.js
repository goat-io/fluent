/* global describe, it, before */
import 'babel-polyfill';
import chai from 'chai';
import Model from 'Fluent/Model';
import Fluent from 'Fluent/Fluent';

import DB from 'models/DB';
chai.expect();
const expect = chai.expect;
let testModel;
let testModel2;

describe('Given a FLUENT Local Model', () => {
  before(() => {
    testModel = Fluent.extend(Model, {
      properties: {
        name: 'myTestModel',
        path: 'myRemoteTest'
      },
      methods: {}
    }).compose(Fluent.privatize)();

    testModel2 = Fluent.extend(Model, {
      properties: {
        name: 'myTestModel2',
        path: 'myRemoteTest2'
      },
      methods: {}
    }).compose(Fluent.privatize)();
  });

  it('name should be Private', () => {
    expect(testModel.name).to.be.equal(undefined);
  });

  it('name should be visible using a getter and composable overwriting properties', () => {
    expect(testModel.getModelName()).to.be.equal('myTestModel');
  });

  it('Should insert Data', async () => {
    let data = await testModel.local().insert({
      test: true,
      order: 1,
      nestedTest: { a: [6, 5, 4], b: { c: true, d: [2, 1, 0] }, c: 4 },
      created: '2018-12-03'
    });

    await testModel.local().insert({
      test: false,
      order: 2,
      nestedTest: { a: [3, 2, 1], b: { c: true, d: [1, 1, 0] }, c: 3 },
      created: '2017-12-03'
    });
    await testModel.local().insert({
      test: false,
      order: 3,
      nestedTest: { a: [0, -1, -2], b: { c: true, d: [0, 1, 0] }, c: 2 },
      created: '2016-12-03'
    });

    let data2 = await testModel2.local().insert({
      test: true,
      nestedTest: { a: [5, 4, 3], b: { c: true, d: [2, 1, 0] }, c: 1 }
    });

    expect(data.nestedTest.a[0]).to.be.equal(6);
    expect(data2.nestedTest.a[0]).to.be.equal(5);
  });

  it('Should get local data', async () => {
    let data = await testModel.local().all();

    expect(data[0].nestedTest.a[0]).to.be.equal(6);
  });

  it('DB should get data for any local Model', async () => {
    let data = await DB.table({ name: 'myTestModel' })
      .local()
      .all();

    expect(data[0].nestedTest.a[0]).to.be.equal(6);

    data = await DB.table({ name: 'myTestModel2' })
      .local()
      .all();
    expect(data[0].nestedTest.a[0]).to.be.equal(5);
  });

  it('select() should filter and name specific columns', async () => {
    let data = await testModel
      .local()
      .select('nestedTest.b.d[2] as myCustomName', 'fake.a as myA', [
        'fake.b[1] as anotherB',
        'fake.b.2.0.d as myvalue'
      ])
      .get();

    expect(data[0]['myCustomName']).to.be.equal(0);
  });

  it('pluck() should return a single array', async () => {
    let data = await testModel.local().pluck('test');

    expect(data[0]).to.be.equal(true);
  });

  it('orderBy() should order results desc', async () => {
    let forms = await testModel
      .local()
      .select('test', 'nestedTest.b.d[0] as custom', 'order')
      .orderBy('custom', 'desc')
      .get();

    expect(forms[0].order).to.be.equal(1);
  });

  it('orderBy() should order results asc', async () => {
    let forms = await testModel
      .local()
      .select('test', 'nestedTest.b.d[0] as custom', 'order')
      .orderBy('custom', 'asc')
      .get();

    expect(forms[0].order).to.be.equal(3);
  });

  it('orderBy() should order by Dates with Select()', async () => {
    let forms = await testModel
      .local()
      .select('created', 'order')
      .orderBy('created', 'asc', 'date')
      .get();

    expect(forms[0].order).to.be.equal(3);
  });

  it('orderBy() should order by Dates without Select()', async () => {
    let forms = await testModel
      .local()
      .orderBy('created', 'asc', 'date')
      .get();

    expect(forms[0].order).to.be.equal(3);
  });

  it('limit() should limit the amount of results', async () => {
    let forms = await testModel
      .local()
      .select('created', 'order')
      .orderBy('created', 'asc', 'date')
      .limit(2)
      .get();

    expect(forms.length).to.be.equal(2);
  });

  it('offset() should start at the given position', async () => {
    let forms = await testModel
      .local()
      .select('created', 'order')
      .offset(1)
      .limit(1)
      .get();

    expect(forms[0].order).to.be.equal(2);
  });

  it('where() should filter the data', async () => {
    let forms = await testModel
      .local()
      .where(['nestedTest.c', '>=', 3])
      .get();

    expect(forms.length).to.be.equal(2);
  });

  it('first() should take the first result from data', async () => {
    let form = await testModel
      .local()
      .where(['nestedTest.c', '>=', 3])
      .orderBy('order', 'desc')
      .first();

    expect(form.order).to.be.equal(2);
  });

  it('clear() should remove all records from the Model', async () => {
    await testModel.local().clear();
    await testModel2.local().clear();

    let forms = await testModel.local().all();

    expect(forms.length).to.be.equal(0);
  });
});
