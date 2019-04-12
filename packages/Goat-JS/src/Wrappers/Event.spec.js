/* global describe, it, before */
import 'babel-polyfill';
import chai from 'chai';
import Event from './Event';

chai.expect();

const expect = chai.expect;
let event = { name: 'myBasicEvent', data: { test: 'true' }, text: 'Some test' };
let eventWorked = false;

let changeEventStatus = function () {
  eventWorked = !eventWorked;
};

function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

describe('Given the Event Class', () => {
  before(() => {
    Event.listen({ name: 'myBasicEvent', callback: changeEventStatus });
  });

  it('emit() Should fail with no event name', async () => {
    expect(() => {
      Event.emit({ data: { test: true }, text: 'Some test' });
    }).to.throw('Event must have a name.');
  });
  it('emit() Should fail with no event data', async () => {
    expect(() => {
      Event.emit({ name: 'myEvent', text: 'Some test' });
    }).to.throw('Event must have data.');
  });
  it('listen() Should fail with no event name', async () => {
    expect(() => {
      Event.listen({ callback: changeEventStatus });
    }).to.throw('Listener must have a name.');
  });
  it('listen() Should fail with no event name', async () => {
    expect(() => {
      Event.listen({ name: 'Myname' });
    }).to.throw('Listener must have a callback.');
  });

  it('emit() and listen() Should should work in sync', async () => {
    expect(eventWorked).to.be.equal(false);
    Event.emit(event);
    while (!eventWorked) {
      console.log('waiting for event to trigger...');
      await sleep(500);
    }
    expect(eventWorked).to.be.equal(true);
  });

  it('remove() should delete the event', async () => {
    expect(eventWorked).to.be.equal(true);
    Event.emit(event);

    expect(eventWorked).to.be.equal(false);

    Event.remove({ name: 'myBasicEvent', callback: changeEventStatus });
    Event.emit(event);
    expect(eventWorked).to.be.equal(false);
  });
});
