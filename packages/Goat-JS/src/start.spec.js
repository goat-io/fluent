/* global describe, it, before */
import 'babel-polyfill';
import chai from 'chai';
import FAST from './start.js';
import TRANSLATIONS from '../test/resources/Localizations/appTranslations';

chai.expect();

const expect = chai.expect;
let fast;

let APP_CONFIG_ID = '5b50a6571c8da0f446286093';
let CONFIG_URL = 'https://ydvahgxgqliaeuf.form.io/configuration/submission/';
let OFFLINE_START = true;

let appConf = {
  type: 'remote',
  appConfigId: APP_CONFIG_ID,
  appConfigUrl: CONFIG_URL,
  i18n: TRANSLATIONS,
  offlineStart: OFFLINE_START,
  offlineFiles: {
    Configuration: require('../test/resources/offline/Configuration.json'),
    Roles: require('../test/resources/offline/Roles.json'),
    lastUpdated: require('../test/resources/offline/lastUpdate.json'),
    Translations: require('../test/resources/offline/Translations.json'),
    Pages: require('../test/resources/offline/Pages.json'),
    Forms: require('../test/resources/offline/Forms.json')
  }
};

describe('Given FAST start', () => {
  before(async () => {
    fast = await FAST.start({ appConf });
  });

  it('Should return the formatted configuration', () => {
    delete fast.config.$loki;
    delete fast.config._id;
    delete fast.config.meta;
    delete fast.config.fastUpdated;
    let config = {
      project: 'FAST',
      APP_ENV: 'dev',
      IS_SURVEY: true,
      APP_FANTACY_NAME: 'FAST',
      APP_PHRASE: 'FAST Demo',
      APP_URL: 'https://vnikkswzjatywzi.form.io',
      APP_NAME: 'vnikkswzjatywzi',
      HEARTBEAT_URL: 'https://dog.ceo/api/breeds/list/all',
      OPEN_CPU_URL: 'https://public.opencpu.org/',
      HAS_ABOUT: true,
      TAB_MENU: false,
      HAS_SCORES: false,
      HAS_REPORT: false,
      ENABLE_REGISTER: true,
      MULTILANGUAGE: true,
      PARALLEL_SURVEYS: false,
      DATA_REVIEWERS: true,
      LOCAL_DB_PASSWORD: 'onePassword123',
      MD5_KEY: 'my_super_secure_key',
      OFFLINE_FIRST: true,
      OFFLINE_USE: true,
      LOCAL_DRAFT_ENABLED: true,
      NAVIGATION_OPENED: false,
      NAVIGATION_AUTOCLOSE_ON_SELECTION: true,
      SAVE_REDIRECT: 'dashboard',
      submit: true
    };

    expect(fast.config).to.deep.equal(config);
  });

  it('Should return the formatted DefaultLanguage', () => {
    expect(fast.defaultLanguage).to.be.equal('en');
  });

  it('Should return the formatted Translations', () => {
    let translations = {
      label: {
        'Filter results...': 'Filter results...',
        'New Survey': 'New Survey',
        'Collected data': 'Collected data'
      },
      en: {
        'Filter results...': 'Filter results...',
        'New Survey': 'New Survey',
        'Collected data': 'Collected data'
      }
    };

    expect(fast.translations).to.deep.equal(translations);
  });
});
