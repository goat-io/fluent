/* global describe, it, before */
import 'babel-polyfill';
import chai from 'chai';
import Utilities from './utilities';

const expect = chai.expect;

describe('Given an Instance of Utilities', () => {
  it('It should remove null values recursively from an Object', () => {
    let object = {
      property: 'val1',
      property1: null,
      nested: {
        property: 'val1',
        property1: null,
        nested: {
          property: 'val1',
          property1: null,
          nested: {
            property: 'val1',
            property1: null
          }
        }
      }
    };
    let test = Utilities.deleteNulls(object);
    let expected = {
      property: 'val1',
      nested: {
        property: 'val1',
        nested: {
          property: 'val1',
          nested: {
            property: 'val1'
          }
        }
      }
    };

    expect(test).to.deep.equal(expected);
  });
});
