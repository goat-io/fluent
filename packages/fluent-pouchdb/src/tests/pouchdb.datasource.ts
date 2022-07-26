import PouchDB from 'pouchdb'

export const dataSource = new PouchDB('goats', {adapter: 'memory'});