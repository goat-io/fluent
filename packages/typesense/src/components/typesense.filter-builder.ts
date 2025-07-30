// npx vitest run ./src/services/search/typesense.filter-builder.test.ts

/**
 * Safe filter builder for Typesense to prevent injection and typos
 */
export class TypesenseFilterBuilder {
  private filters: string[] = []

  /**
   * Add an equality filter
   * @param field - Field name to filter on
   * @param value - Value to match
   */
  equals(field: string, value: string | number | boolean): this {
    this.filters.push(`${this.escapeField(field)}:=${this.escapeValue(value)}`)
    return this
  }

  /**
   * Add a not-equals filter
   * @param field - Field name to filter on
   * @param value - Value to not match
   */
  notEquals(field: string, value: string | number | boolean): this {
    this.filters.push(`${this.escapeField(field)}:!=${this.escapeValue(value)}`)
    return this
  }

  /**
   * Add an IN filter for matching multiple values
   * @param field - Field name to filter on
   * @param values - Array of values to match
   */
  in(field: string, values: Array<string | number>): this {
    const escapedValues = values.map(v => this.escapeValue(v)).join(', ')
    this.filters.push(`${this.escapeField(field)}:=[${escapedValues}]`)
    return this
  }

  /**
   * Add a NOT IN filter
   * @param field - Field name to filter on
   * @param values - Array of values to not match
   */
  notIn(field: string, values: Array<string | number>): this {
    const escapedValues = values.map(v => this.escapeValue(v)).join(', ')
    this.filters.push(`${this.escapeField(field)}:!=[${escapedValues}]`)
    return this
  }

  /**
   * Add a greater than filter (numeric fields only)
   * @param field - Field name to filter on
   * @param value - Value to compare against
   */
  greaterThan(field: string, value: number): this {
    this.filters.push(`${this.escapeField(field)}:>${value}`)
    return this
  }

  /**
   * Add a greater than or equal filter (numeric fields only)
   * @param field - Field name to filter on
   * @param value - Value to compare against
   */
  greaterThanOrEqual(field: string, value: number): this {
    this.filters.push(`${this.escapeField(field)}:>=${value}`)
    return this
  }

  /**
   * Add a less than filter (numeric fields only)
   * @param field - Field name to filter on
   * @param value - Value to compare against
   */
  lessThan(field: string, value: number): this {
    this.filters.push(`${this.escapeField(field)}:<${value}`)
    return this
  }

  /**
   * Add a less than or equal filter (numeric fields only)
   * @param field - Field name to filter on
   * @param value - Value to compare against
   */
  lessThanOrEqual(field: string, value: number): this {
    this.filters.push(`${this.escapeField(field)}:<=${value}`)
    return this
  }

  /**
   * Add a range filter (numeric fields only)
   * @param field - Field name to filter on
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (inclusive)
   */
  range(field: string, min: number, max: number): this {
    this.filters.push(
      `${this.escapeField(field)}:>=${min} && ${this.escapeField(field)}:<=${max}`
    )
    return this
  }

  /**
   * Add a contains filter (string fields only)
   * @param field - Field name to filter on
   * @param value - Value to search for
   */
  contains(field: string, value: string): this {
    this.filters.push(`${this.escapeField(field)}:*${this.escapeValue(value)}*`)
    return this
  }

  /**
   * Add a starts with filter (string fields only)
   * @param field - Field name to filter on
   * @param value - Prefix to match
   */
  startsWith(field: string, value: string): this {
    this.filters.push(`${this.escapeField(field)}:${this.escapeValue(value)}*`)
    return this
  }

  /**
   * Add a ends with filter (string fields only)
   * @param field - Field name to filter on
   * @param value - Suffix to match
   */
  endsWith(field: string, value: string): this {
    this.filters.push(`${this.escapeField(field)}:*${this.escapeValue(value)}`)
    return this
  }

  /**
   * Add an exists/not null filter
   * @param field - Field name to check
   */
  exists(field: string): this {
    this.filters.push(`${this.escapeField(field)}:!=null`)
    return this
  }

  /**
   * Add a not exists/null filter
   * @param field - Field name to check
   */
  notExists(field: string): this {
    this.filters.push(`${this.escapeField(field)}:=null`)
    return this
  }

  /**
   * Group filters with AND logic
   * @param callback - Callback to build grouped filters
   */
  and(callback: (builder: TypesenseFilterBuilder) => void): this {
    const subBuilder = new TypesenseFilterBuilder()
    callback(subBuilder)
    const subFilter = subBuilder.build()
    if (subFilter) {
      this.filters.push(`(${subFilter})`)
    }
    return this
  }

  /**
   * Group filters with OR logic
   * @param callback - Callback to build grouped filters
   */
  or(callback: (builder: TypesenseFilterBuilder) => void): this {
    const subBuilder = new TypesenseFilterBuilder()
    callback(subBuilder)
    const subFilters = subBuilder.filters
    if (subFilters.length > 0) {
      this.filters.push(`(${subFilters.join(' || ')})`)
    }
    return this
  }

  /**
   * Add a raw filter expression (use with caution)
   * @param expression - Raw filter expression
   */
  raw(expression: string): this {
    this.filters.push(expression)
    return this
  }

  /**
   * Build the final filter string
   * @returns The constructed filter string
   */
  build(): string {
    return this.filters.join(' && ')
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.filters = []
    return this
  }

  /**
   * Escape field name to prevent injection
   * @private
   */
  private escapeField(field: string): string {
    // Field names in Typesense can contain alphanumeric characters and underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
      throw new Error(
        `Invalid field name: ${field}. Field names must start with a letter or underscore and contain only alphanumeric characters and underscores.`
      )
    }
    return field
  }

  /**
   * Escape value to prevent injection
   * @private
   */
  private escapeValue(value: string | number | boolean): string {
    if (typeof value === 'string') {
      // Escape backslashes first, then quotes
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    }
    return String(value)
  }
}

/**
 * Create a new filter builder instance
 */
export function filterBuilder(): TypesenseFilterBuilder {
  return new TypesenseFilterBuilder()
}
