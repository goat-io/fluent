# FASTjs

A JS library to give you wrapper Fluent methods on top of Form.io. It creates all the necesary classes for you to use your Form.io forms as they were Models, working both online and offline.

GoatJs + Form.io will help you develop faster in any Framework

### Installing

To install this package in your project, you can use the following command within your terminal.
```
npm install --save fast-fastjs
```

# Usage

The main function of FASTjs is FAST, this function will initialize all configurations, translations and register forms that you have in your Form.io project and will load them into the local LokiJs DB.

An example of the init for a Vue application

```javascript
import {FAST} from 'fast-fastjs';

let config = await FAST.start(
		    {
            appConf          // {Object} Configuration for the FASTjs library
        }
    );
```

### The appConfig variable

The config variable can be placed in two different ways: Directly as an object or as a remote Form.io submission.

We give the flexibility to pull the configuration every time we start the project specially for those mobile applications that we do not want to re-deploy every time we change a small configuration of the App. With the remote approach you can just simple update your Form.io Submission and the application will pull it for you.

```javascript
// If we want to directly pass all configuration from here
  let appConf = {
    type: 'local',                     // {String} type of config "remote" or "local"
    config                             // {Object} full configuration of the App (check below)
    translations: TRANSLATIONS         // {Object} i18n translations for the app
  };

// If we are storing our project configuration in Form.io
  let appConfigUrl = 'https://ydvyhgtgqlcasur.form.io/configuration/submission/5a956eav847b730402b25656'
  let appConf = {
    type: 'remote',                // {String} type of config "remote" or "local"
    appConfigUrl,                  // {String} Full URL tot he Form.io Form with the config
    translations: TRANSLATIONS,     // {Object} i18n translations for the App
    fluentFormioBaseUrl: FLUENT_FORMIO_BASEURL,
    offlineFiles: {
      Configuration: require('Configuration.json'),
      Roles: require('Roles.json'),
      lastUpdated: require('lastUpdate.json'),
      Translations: require('Translations.json'),
      Pages: require('Pages.json'),
      Forms: require('Forms.json')
     }
  };
```

In case you are using local config, your config object should look like this

| Ouput String                      | Values                                         | Description                                        |
| --------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| project                           | {String} 'MyApp'                               | Name of the project                                |
| APP_ENV                           | {String} 'prod', 'dev'                         | Current Environment of the App ('prod', 'dev')     |
| FAST_VERSION                      | {String} '0.11.0'                              | Version of the FAST App used                       |
| IS_SURVEY                         | {Bolean}                                       | Set the app as Data Collection                     |
| TAB_MENU                          | {Bolean}                                       | Should the pages display as Tabs?                  |
| HAS_SCORES                        | {Bolean}                                       | Do the surveys have scores?                        |
| HAS_ABOUT                         | {Bolean}                                       | Does they App have an About page?                  |
| HAS_REPORT                        | {Bolean}                                       | Do the surveys have a Report page?                 |
| SAVE_REDIRECT                     | {String} 'collected'                           | Where should we redirect after save                |
| APP_URL                           | {String} https://uiprzrzfcxygdno.form.io       | What is the Form.io URL for the project?           |
| APP_NAME                          | {String} 'uiprzrzfcxygdno'                     | What is the Form.io app name (Check App url)       |
| APP_FANTACY_NAME                  | {String} 'MyBApp'                              | The custom name to display in the App              |
| APP_NAME_DRAWER                   | {String} 'MyBApp'                              | The custom name to display in the App left Drawer  |
| APP_PHRASE                        | {String} 'A meaningful app'                    | The phrase of the app                              |
| APP_ABOUT_NAME                    | {String} 'MyApp'                               | Name to display for the ABOUT link                 |
| MD5_KEY                           | {String}Md5 '2448A2EF5FA031F4DC740C90C6A328B0' | MD5 key for hashing                                |
| LOCAL_DB_PASSWORD                 | {String} 'MySec!ur!Pas'                        | Password to access local Loki DB                   |
| HEARTBEAT_URL                     | {String} 'http://localhost:3000/'              | URL to check the connection Status                 |
| SYNC_INTERVAL                     | {Int} 2000                                     | Miliseconds to wait until the next Sync            |
| MULTILANGUAGE                     | {Bolean}                                       | Is the app multilanguage?                          |
| LOCAL_DRAFT_ENABLED               | {Bolean}                                       | Should we allow Local Draft submissions            |
| PARALLEL_SURVEYS                  | {Bolean}                                       | Enable the paeallel surveys functionality?         |
| NAVIGATION_OPENED                 | {Bolean}                                       | Should the page navegation start opened?           |
| NAVIGATION_AUTOCLOSE_ON_SELECTION | {Bolean}                                       | After selecting a page, should the page nav close? |
| DATA_REVIEWERS                    | {Bolean}                                       | Does the app need the DataReviewers functionality? |

If you are using Form.io to manage the config, you can use the following form to hold your configurations.

Remember to import this in your own Form.io Project.[(View it here!)](https://fast-app-config.stackblitz.io/)


# FAST Models

FAST offers 8 main Models that you can use to access and manipulate your data

| Model Name    | Description                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------- |
| baseModel     | The main model used for all others. If you need to create your own, you can extend this one |
| Configuration | Access to all project configuration                                                         |
| Form          | Access to all Forms and Resources used in the application                                   |
| Pages         | Access to all pages defined for the project                                                 |
| Role          | Access to all roles defined for the project                                                 |
| Submission    | Access to all submissions defined for the project                                           |
| Translation   | Access to all translations defined for the project                                          |
| User          | Access to the Users of the application                                                      |

The models can be used to access both local (LokiJS DB) or remote data (Form.io Server) by calling the remote() or local() methods.

```javascript
import {Form} from 'fast-fastjs';

let localForms = await Form.local().find();
let remoteForms = await Form.remote().find();
```

We could also work with both, local and remote using the merged() method

```javascript
import {Form} from 'fast-fastjs';

let bothForms = await Form.merged().find();
```

We are still working on standardizing the methods for both local and remote so please
check how each one works before trying to swap from one to the other

| Method Name      | Parameters | Description                                                                |
| ---------------- | ---------- | -------------------------------------------------------------------------- |
| getOwnName       |            | Returns the Name of the Current Model                                      |
| getFormPath      |            | Returns the Form.io Path of the current Model                              |
| remote           |            | Returns the Same Model but with the getFrom variable set to 'remote'       |
| local            |            | Returns the Same Model but with the getFrom variable set to 'local'        |
| merged           |            | Returns the Same Model but with the getFrom variable set to 'remote-local' |
| find             |            | Find method on top of the Model {Array}                                    |
| findOne          |            | Find an element based on the filters and returns the first. {Object}       |
| remove           |            | Removes the given element from the storage                                 |
| insert           |            | Inserts a new element into the storage                                     |
| update           |            | Updates the given element                                                  |
| updateOrCreate   |            | Tries to update an element, if it doesn´t exist it creates it              |
| findAndRemove    |            | Finds and element and then deletes it                                      |

Every model has acces to the same basic functionalities given by the baseModel

# FAST Helper Functions

| Function Name  | Description                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Auth           | Useful set of functions to Authenticate and work with the Auth user                              |
| Event          | Native JS event emitter                                                                          |
| Moment         | A wrapper on top of Moment to use all translations (multilanguage projects)                      |
| ParallelSurvey | Set of functions to work with more than one survey at the same time                              |
| Localization   | Set of functions to work with the translations                                                   |
| OfflinePlugin  | The full Form.io offline plugin used. Useful when you have to activate, or deactivate the plugin |
