# FLUENT

A JS library that gives a readable query builder. It takes care of the heavy work for you to enjoy quering your services.
Fluent works for both Local and Remote Storage/API providers

### Installing

To install this package in your project, you can use the following command within your terminal.

```
npm install --save fast-fluent
```

# Config

Fluent offers a handy configuration method that will get you up and running in seconds.

```javascript
import {Fluent} from 'fast-fluent';

Fluent.config(
		    {
          REMOTE_CONNECTORS: [{}],
          LOCAL_CONNECTORS: [{}],
          MERGE_CONNECTORS: [{}]
        }
    );
```

## Connectors
All Fluent connectors are independent libraries, so you will need to download them separetly. 

Here is an example of a REMOTE connector using fluent-formio

```javascript
import formio from 'fluent-formio'
{
    name: 'formio',
    baseUrl: 'https://ydrahgggqviwquft.form.io/',
    connector: formio
}

```
You can use as many connectors as you like. All available connectors are listed bellow.

### REMOTE

Remote connectors give you access to API's or Databases, such as MongoDB, Formio
| Provider        | Library         | 
| --------------- | --------------- |
| Formio          | fluent-formio   |

### LOCAL
Local connectors give you access to in Browser/Memory DB's such as LokiJs, IndexedDB, LocalStorage

| Provider        | Library         | 
| --------------- | --------------- |
| LockiJS          | fluent-loki   |

### MERGE
Merge connectors will pull from both Local and Remote storage providers and will merge results
to give you access to all your data from one call

| Provider        | Library         | 
| --------------- | --------------- |
| Loki-Formio          | fluent-loki-formio   |

### Your first Model

To start using Fluent your will need to create a Fluent Model.
Every Fluent Model is a @stampit, so you can further compose it as you like.
If you only defined one connector it will be used as default, so no need to configure your models

```javascript
const Mymodel = Fluent.model({
  properties: {
    name: 'Mymodel',
  }
})
```

In case you defined multiple connectors, your model will need to choose where to get its data from

```javascript
const Mymodel = Fluent.model({
  properties: {
    name: 'Mymodel',
    config: {
      remote: {
        connector: 'formio'
      },
      local: {
        connector: 'loki'
      }
    }
  }
})
```


Onother way of defining a connector as default when using multiple connectors, is to set it on the Fluent.config

```javascript
import {Fluent} from 'fast-fluent';
import formio from 'fluent-formio'

Fluent.config(
		    {
          REMOTE_CONNECTORS: [{
              default: true,
              name: 'formio',
              baseUrl: 'https://ydrahgggqviwquft.form.io/',
              connector: formio
          }, {...}, {...}],
        }
    );


```

# Using a Fluent Model

## Remote, Local or Merge?

Every Fluent Model can pull/push data from those 3 sources. All Fluent methods are ASYNC functions
be patient and AWAIT for them ;)

```javascript
const Mymodel = Fluent.model({
  properties: {
    name: 'Mymodel',
  }
})()

// Option 1
let model = await Mymodel.remote()
// Option 2
let model = await Mymodel.local()
// Option 3
let model = await Mymodel.merge()
```

After deciding where to pull/push the data from you will have access to quite a few helpful methods

## Basic CRUD methods

### Creating
```javascript
const Mymodel = Fluent.model({
  properties: {
    name: 'Mymodel',
  }
})()
const myObj = { foo : "bar", pin: "pon"}
const myArrayOfObjs = [{ foo : "bar", pin: "pon"}, { foo : "bar", pin: "pon"}]
// Single insert example
let inserted = await Mymodel.remote().insert(myObj)

// Multiple insert example
let inserted = await Mymodel.remote().insert(myArrayOfObjs)

```

### Updating
All Fluent models identify records by de _id identifier. To update a record you MUST give it the _id

```javascript
const Mymodel = Fluent.model({
  properties: {
    name: 'Mymodel',
  }
})()
// Single insert example
let updated = await Mymodel.remote().update({_id : 'abcdefghjklmnopqrsuvwxyz', myNewData: 'SomeNewData' })
```

### Deleting
To remove a records you must provide its ID

```javascript
const Mymodel = Fluent.model({
  properties: {
    name: 'Mymodel',
  }
})()
// Single insert example
let updated = await Mymodel.remote().remove('abcdefghjklmnopqrsuvwxyz')
```

# Reading - Query Builder

Here is where we start having fun with Fluent.
Fluent offers a powerful QueryBuilder HEAVILY inspired in Laravel (Thanks Taylor Otwell!!)

## Get all Objects (rows)
```javascript
const Users = Fluent.model({
  properties: {
    name: 'Users',
  }
})()
// Single insert example
let users = await Users.remote().get()
```
Unlike Laravel, Fluent get() Method returns and Array with the requested Objects, ready for you to use.

```javascript
 users.forEach(user => console.log(user.name))
```

## Get a single Object (row)

```javascript
const Users = Fluent.model({
  properties: {
    name: 'Users',
  }
})()
// Single insert example
let user = await Users.remote().first()
```

In this case Fluent will return a single Object

```javascript
 user.name
```


## Get a list of Column Values
```javascript
const Users = Fluent.model({
  properties: {
    name: 'Users',
  }
})()
// Single insert example
let names = await Users.remote().pluck('name')
```


## Select

```javascript
const Users = Fluent.model({
  properties: {
    name: 'Users',
  }
})()
// Single insert example
let users = await Users.remote().select('name', 'last_name as lastName').get()

// Its also possible to pass it as an Array
let users = await Users.remote().select(['name', 'last_name as lastName']).get()
```

## Ordering, Grouping, Limit & Offset

### orderBy

```javascript
const Users = Fluent.model({
  properties: {
    name: 'Users',
  }
})()
// Single insert example
let users = await Users.remote().select('name', 'last_name as lastName').orderBy('lastName', 'asc')get()

```


### skip / take

```javascript
const Users = Fluent.model({
  properties: {
    name: 'Users',
  }
})()
// Single insert example
let users = await Users.remote().select('name')
            .skip(10)
            .take(10)
            .get()
```
Is the same as

```javascript
const Users = Fluent.model({
  properties: {
    name: 'Users',
  }
})()
// Single insert example
let users = await Users.remote().select('name')
            .offset(10)
            .limit(10)
            .get()
```


# Collections

To further operate your data, you can turn your results into Collections (Yes, Thanks again Taylor!)
Just make sure to call the collect method instead of the get()
```javascript
const Users = Fluent.model({
  properties: {
    name: 'Users',
  }
})()
// Single insert example
let users = await Users.remote()
            .limit(10)
            .collect()
```
You can also turn any array into a Fluent Collection by using the collect method

```javascript
let users = [{name: 'John', age: 20}, {name: 'Michael', age: 40}]
// Single insert example
let users = Fluent.collect(users)
```

Now with the collection on hand, you can use the following operators

## average
Alias for avg()
```javascript
users.average('age')

// 30
```

## avg
```javascript
users.avg('age')

// 30
```

## Chunk
Chunk will just get all results and then separate them in smaller Arrays.

```javascript
users.chunk(1)

// [[{name: 'John', age: 20}],[{name: 'Michael', age: 40}]]
```


## Collapse

```javascript
let collection = Fluent.collect(users.chunk(1));
collection.collapse()
// [{name: 'John', age: 20}, {name: 'Michael', age: 40}]
```