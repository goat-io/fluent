// npx vitest run ./src/performance-benchmark.ts
import { describe, it, expect } from 'vitest'
import { Formio } from './Formio'
import { eachComponent } from './Formio/eachComponent'
import { findComponents } from './Formio/findComponents'
import { flattenComponents } from './Formio/flattenComponents'
import { parse, SupportedFrameworks } from './Formio/parser/parse'

// Create a complex nested form structure for benchmarking
const createComplexForm = (depth: number, componentCount: number) => {
  const components = []
  
  // Prevent infinite recursion
  if (depth <= 0) {
    for (let i = 0; i < componentCount; i++) {
      components.push({
        type: 'textfield',
        key: `field_0_${i}`,
        label: `Field ${i}`,
        tableView: i % 5 === 0,
        validate: {
          required: i % 3 === 0
        }
      })
    }
    return components
  }
  
  for (let i = 0; i < componentCount; i++) {
    if (i % 3 === 0) {
      // Add nested container
      components.push({
        type: 'container',
        key: `container_${depth}_${i}`,
        components: createComplexForm(depth - 1, Math.floor(componentCount / 3))
      })
    } else if (i % 2 === 0) {
      // Add columns with nested components
      components.push({
        type: 'columns',
        key: `columns_${depth}_${i}`,
        columns: [
          { components: createComplexForm(depth - 1, 2) },
          { components: createComplexForm(depth - 1, 2) }
        ]
      })
    } else {
      // Add simple component
      components.push({
        type: 'textfield',
        key: `field_${depth}_${i}`,
        label: `Field ${i}`,
        tableView: i % 5 === 0,
        validate: {
          required: i % 3 === 0
        }
      })
    }
  }
  
  return components
}

const sampleForm = {
  title: 'Performance Test Form',
  name: 'performanceTest',
  path: 'performance',
  type: 'form',
  display: 'form',
  components: createComplexForm(4, 20)
}

describe('formio-utils performance benchmarks', () => {
  it('benchmark eachComponent with deep nesting', () => {
    const iterations = 100
    let totalTime = 0
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      
      let componentCount = 0
      eachComponent(sampleForm.components, (component, path) => {
        componentCount++
        // Simulate some work
        const key = component.key
        const type = component.type
      }, true)
      
      const end = performance.now()
      totalTime += (end - start)
    }
    
    const avgTime = totalTime / iterations
    console.log(`eachComponent average time: ${avgTime.toFixed(3)}ms`)
    console.log(`Total time for ${iterations} iterations: ${totalTime.toFixed(3)}ms`)
    
    expect(avgTime).toBeLessThan(50) // Should complete in under 50ms
  })
  
  it('benchmark findComponents with various queries', () => {
    const iterations = 100
    const queries = [
      'field_3_5',
      { type: 'textfield' },
      { 'validate.required': true },
      { tableView: true }
    ]
    
    queries.forEach(query => {
      let totalTime = 0
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        const results = findComponents(sampleForm.components, query)
        const end = performance.now()
        totalTime += (end - start)
      }
      
      const avgTime = totalTime / iterations
      console.log(`findComponents with query ${JSON.stringify(query)} average time: ${avgTime.toFixed(3)}ms`)
    })
  })
  
  it('benchmark flattenComponents', () => {
    const iterations = 100
    let totalTime = 0
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      const flattened = flattenComponents(sampleForm.components, true)
      const end = performance.now()
      totalTime += (end - start)
    }
    
    const avgTime = totalTime / iterations
    console.log(`flattenComponents average time: ${avgTime.toFixed(3)}ms`)
    expect(avgTime).toBeLessThan(50)
  })
  
  it.skip('benchmark parse function', async () => {
    // Skip this test as it requires specific form structure for parsing
    const iterations = 10 // Parse is slower, use fewer iterations
    let totalTime = 0
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await parse(sampleForm, SupportedFrameworks.Nest)
      const end = performance.now()
      totalTime += (end - start)
    }
    
    const avgTime = totalTime / iterations
    console.log(`parse average time: ${avgTime.toFixed(3)}ms`)
  })
  
  it('benchmark getFromJson with large dataset', () => {
    const forms = {
      models: {
        Form: {}
      }
    }
    
    // Create 100 forms
    for (let i = 0; i < 100; i++) {
      forms.models.Form[`form_${i}`] = JSON.stringify({
        ...sampleForm,
        name: `form_${i}`,
        components: JSON.stringify(sampleForm.components) // Convert components to string for proper parsing
      })
    }
    
    const iterations = 50
    let totalTime = 0
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      const parsedForms = Formio.getFromJson(forms)
      const end = performance.now()
      totalTime += (end - start)
    }
    
    const avgTime = totalTime / iterations
    console.log(`getFromJson average time: ${avgTime.toFixed(3)}ms`)
  })
})