import * as _ from 'lodash'
import { getRules } from './JoiRules'

const Joi = require('joi')

export const JoiX = Joi.extend([
  {
    name: 'any',
    language: {
      custom: '{{message}}',
      json: '{{message}}',
      hidden: '{{message}}',
      select: '{{message}}',
      distinct: '{{message}}'
    },
    rules: getRules('any')
  },
  {
    name: 'string',
    base: Joi.string(),
    language: {
      custom: '{{message}}',
      maxWords: '{{message}}',
      minWords: '{{message}}',
      json: '{{message}}',
      hidden: '{{message}}',
      select: '{{message}}',
      distinct: '{{message}}'
    },
    rules: getRules('string')
  },
  {
    name: 'array',
    base: Joi.array(),
    language: {
      custom: '{{message}}',
      json: '{{message}}',
      hidden: '{{message}}',
      select: '{{message}}',
      distinct: '{{message}}'
    },
    rules: getRules('array')
  },
  {
    name: 'object',
    base: Joi.object(),
    language: {
      custom: '{{message}}',
      json: '{{message}}',
      hidden: '{{message}}',
      select: '{{message}}',
      distinct: '{{message}}'
    },
    rules: getRules('object')
  },
  {
    name: 'number',
    base: Joi.number(),
    language: {
      custom: '{{message}}',
      json: '{{message}}',
      hidden: '{{message}}',
      select: '{{message}}',
      distinct: '{{message}}'
    },
    rules: getRules('number')
  },
  {
    name: 'boolean',
    base: Joi.boolean(),
    language: {
      custom: '{{message}}',
      json: '{{message}}',
      hidden: '{{message}}',
      select: '{{message}}',
      distinct: '{{message}}'
    },
    rules: getRules('boolean')
  },
  {
    name: 'date',
    base: Joi.date(),
    language: {
      custom: '{{message}}',
      json: '{{message}}',
      hidden: '{{message}}',
      select: '{{message}}',
      distinct: '{{message}}'
    },
    rules: getRules('date')
  }
])
