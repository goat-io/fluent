import stampit from '@stamp/it';
import Utilities from './utilities';

export default stampit({
  init(data) {
    if (!Array.isArray(data)) {
      throw new Error('Collect method only accepts arrays of data');
    }
    this.data = data;
  },
  properties: {
    data: []
  },
  methods: {
    /**
     * 
     */
    get() {
      return this.data;
    },
    /**
     * Alias for the "get" method
     * @return function
     */
    all() {
      return this.get();
    },
    /**
     * Alias for the "average" method.
     *
     * @param  {String}  path Path of the key
     * @return function
     */
    avg(path) {
      return this.average(path);
    },
    /**
     * Get the average value of a given key.
     *
     * @param  {String}  path Path of the key
     * @return static
     */
    average(path = '') {
      let data = [...this.data]
      const sum = data.reduce((acc, element) => {
        let value = element;

        if (element instanceof Object) {
          let extract = Utilities.getFromPath(element, path, undefined);
          if (typeof extract !== 'undefined' && extract.value) {
            value = extract.value
          }
        }
        return acc + value;
      }, 0);

      try {
        const avg = sum / data.length;
        return avg;
      } catch (e) {
        throw new Error('Division between "' + sum + '" and "' + data.length + '" is not valid.');
      }
    },
    async chunkApply(size, callback) {
      if (callback === undefined) {
        throw new Error('Callback function not defined.');
      }

      const totalSize = this.data.length;
      let count = 0;

      this.chunks(size);

      // console.log(`Processed ${count}/${totalSize} elements...`);

      /* for (const chunk of this.data) {
        const promises = [];

        chunk.forEach((element) => {
          promises.push(callback(element, count));
          count = count + 1;
        });

        await Promise.all(promises);

        // count = (count + size) > totalSize ? totalSize : count + size;
        console.log(`Processed ${count}/${totalSize} elements...`);
      } */

      const reducer = (chain, batch) =>
        chain.then(() => Promise.all(batch.map(d => callback(d))))
          .then(() => {
            count = (count + size) > totalSize ? totalSize : count + size;
            console.log(`Processed ${count}/${totalSize} elements...`);
          });

      console.log(`Processed ${count}/${totalSize} elements...`);
      const promiseChain = this.data.reduce(reducer, Promise.resolve());

      return promiseChain;
    },
    /**
     * Chunks the given array
     *
     * @param {Int} size
     * @return static
     */
    chunks(size) {
      let data = [...this.data];
      var results = [];

      while (data.length) {
        results.push(data.splice(0, size));
      }

      this.data = results;
      return this;
    },
    /**
     * 
     */
    collapse() {
      let data = [...this.data];
      var results = [];

      data.forEach((chunk) => {
        if (Array.isArray(chunk)) {
          chunk.forEach((element) => {
            results.push(element);
          });
        } else {
          results.push(chunk);
        }
      });
      this.data = results;

      return this;
    },
    unChunk() {
      return this.collapse();
    },
    combine(array) {
      const data = [...this.data];
      let result;
      data.forEach((e, index) => {
        if (!(e instanceof Object)) {
          if (!result) {
            result = {}
          }
          result[e] = array[index]
        } else {
          if (!result) {
            result = []
          }
          result[index] = { ...e, _value: array[index] }
        }
      })

      this.data = result;
      return this;
    },
    concat(array) {
      this.data = [...this.data, ...array];
      return this;
    },
    contains(...args) {
      let value;
      let path;
      let Fx;
      if (args.length === 1) {
        if (this.isFunction(args[0])) {
          Fx = args[0]
        }
        value = args[0]
      } else {
        value = args[1];
        path = args[0];
      }
      let data = [...this.data];

      return data.some((e, index) => {
        if (Fx) {
          return !!Fx(e, index);
        }
        let val = e;
        if (e instanceof Object) {
          let extract = Utilities.getFromPath(e, path, undefined)
          if (extract.value) {
            val = extract.value
          }
        }
        return val === value

      })
    },
    /**
     * Returns an array of duplicate submissions, based on an array of keys.
     * @param {Array} keys - Keys where the function compares an object to evaluate its similarity. 
     */
    duplicatesBy(keys) {
      const data = [...this.data];
      const duplicates = [];

      data.reduce((object, submission) => {
        const finalKey = keys.reduce((string, key) =>
          string + Utilities.getFromPath(submission, key, '').value
        , '');

        if (object.hasOwnProperty(finalKey)) {
          duplicates.push(submission);
        } else {
          object[finalKey] = true;
        }

        return object;
      }, {});

      this.data = duplicates;

      return this;
    },
    count() {
      return this.data.length;
    },
    isFunction(functionToCheck) {
      return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
    }
  }
});
