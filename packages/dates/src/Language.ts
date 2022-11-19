export const Language = (() => {
  /**
   * Gets default language stored in local storage
   * @returns {string} language code (ie. "en")
   */
  const get = (): string =>
    localStorage.getItem('defaultLanguage') || process.env['DEFAULT_LANGUAGE']
  /**
   * Stores language as default in local database
   * @param {String} code
   */
  const set = (code: string): void => {
    localStorage.setItem('defaultLanguage', code)
  }

  return Object.freeze({ get, set })
})()
