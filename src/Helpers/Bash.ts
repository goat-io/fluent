const exec = require('child_process').exec

export const Bash = (() => {
  /**
   *
   * @param command
   * @param options
   */
  const execute = async (command: string, options?: any) => {
    return new Promise(function(resolve, reject) {
      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          console.log(error)
          reject(new Error(error))
        } else {
          console.log(stdout, stderr)
          resolve({ stdout, stderr })
        }
      })
    })
  }

  return Object.freeze({ execute })
})()
