import { writeFileSync, readFileSync } from 'fs'
const location = './src/Got/ky/index.js'
import { join } from 'path'

let content = readFileSync(join(__dirname, location), 'utf-8')

content = content.replace('u.cancel()', 'u')

writeFileSync(join(__dirname, location), content)
