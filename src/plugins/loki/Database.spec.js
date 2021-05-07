/* global describe, it, before */
import 'babel-polyfill';
import chai from 'chai';
import Database from './Database.js';
import Loki from 'lokijs';

chai.expect();

const expect = chai.expect;
let db;

describe('Given the DB instance', () => {
  before(async () => {
    db = await Database.get({ env: 'testing' });
  });

  it('Should return and instance of LockiJS DB', () => {
    let isLoki = db instanceof Loki;

    expect(isLoki);
  });

  it('Should be named GOAT', () => {
    expect(db.filename).to.be.equal('GOAT');
  });

  it('Should have all basic Collections', () => {
    let expectedCollections = ['Submission', 'Form', 'Translation', 'User', 'Role', 'Configuration', 'Pages'];
    let dbCollections = db.collections.reduce((dbColArray, dbCol) => {
      dbColArray.push(dbCol.name);
      return dbColArray;
    }, []);

    if (expectedCollections.length !== dbCollections.length) {
      return false;
    }
    let uniqueCollections = {};

    expectedCollections.forEach((collection, index) => {
      uniqueCollections[collection] = true;
      uniqueCollections[dbCollections[index]] = true;
    });
    let areTheSame = Object.keys(uniqueCollections).length === expectedCollections.length;

    expect(areTheSame).to.be.equal(true);
  });
});
