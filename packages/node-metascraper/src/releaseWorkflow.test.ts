// pnpm --filter @goatlab/node-metascraper test src/releaseWorkflow.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  resolve(__dirname, '../../../.github/workflows/release-node-metascraper.yml'),
  'utf8',
)
describe('reviewed package release gate', () => {
  it('pins master source and version before a focused package publish', () => {
    expect(workflow).toContain("if: github.ref == 'refs/heads/master'")
    expect(workflow).toContain(
      'process.env.EXPECTED_COMMIT !== process.env.GITHUB_SHA',
    )
    expect(workflow).toContain('pkg.version !== process.env.EXPECTED_VERSION')
    expect(workflow).toContain('response.status !== 404')
    expect(workflow).toContain(
      'pnpm install --frozen-lockfile --ignore-scripts',
    )
    expect(workflow).toContain(
      'pnpm --filter @goatlab/node-metascraper exec biome check .',
    )
    expect(workflow.indexOf('name: Test package')).toBeLessThan(
      workflow.indexOf('name: Publish reviewed package'),
    )
    expect(workflow).toContain(
      `NODE_AUTH_TOKEN: \${{ secrets.GOATLAB_NPM_TOKEN }}`,
    )
    expect(workflow).toContain(
      'pnpm --filter @goatlab/node-metascraper publish --no-git-checks --access public',
    )
    expect(workflow).not.toContain('npm publish')
  })
})
