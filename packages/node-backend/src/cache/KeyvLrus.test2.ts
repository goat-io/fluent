import { KeyvLru } from './KeyvLrus'

import * as test from 'vitest'
import keyvTestSuite from '@keyv/test-suite'
import Keyv from 'keyv'

const store = () => new KeyvLru()
keyvTestSuite(test, Keyv, store)
