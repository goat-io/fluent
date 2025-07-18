# Release Process

The Fluent ecosystem uses **changesets** for version management and automated releases. This document outlines the complete release process from development to production.

## Release Strategy

### Semantic Versioning

The project follows [Semantic Versioning](https://semver.org/) (SemVer):

- **Major** (x.0.0): Breaking changes
- **Minor** (x.y.0): New features (backward compatible)
- **Patch** (x.y.z): Bug fixes (backward compatible)

### Release Channels

#### 1. Development Releases
- **Purpose**: Internal testing and development
- **Frequency**: Continuous
- **Audience**: Development team
- **Stability**: Experimental

#### 2. Beta Releases
- **Purpose**: Pre-release testing
- **Frequency**: Weekly
- **Audience**: Early adopters
- **Stability**: Feature-complete but may have bugs

#### 3. Stable Releases
- **Purpose**: Production use
- **Frequency**: Monthly
- **Audience**: All users
- **Stability**: Production-ready

### Package Dependencies

Release order follows dependency chain:

1. **js-utils** → Base utilities
2. **node-utils** → Node.js utilities (depends on js-utils)
3. **fluent** → Core package (depends on both utils)
4. **Connectors** → Database connectors (depend on fluent)
5. **Extensions** → Additional packages (depend on core)

## Changesets Workflow

### 1. Creating Changesets

When making changes, create a changeset:

```bash
# Add changeset
pnpm changeset

# Follow prompts:
# - Select packages to version
# - Choose version bump type
# - Write changeset description
```

#### Changeset Types

**Major (Breaking Changes):**
```markdown
---
"@goatlab/fluent": major
---

BREAKING CHANGE: Remove deprecated FluentConnector class

The FluentConnector class has been removed in favor of specific connector classes like TypeOrmConnector, FirebaseConnector, etc.

Migration guide: https://docs.goatlab.io/migration/version-migration
```

**Minor (New Features):**
```markdown
---
"@goatlab/fluent": minor
"@goatlab/js-utils": minor
---

Add support for MongoDB aggregation pipelines

New aggregation pipeline support allows complex data transformations directly in the database.
```

**Patch (Bug Fixes):**
```markdown
---
"@goatlab/fluent": patch
---

Fix query builder issue with nested conditions

Resolves issue where nested AND/OR conditions were not properly parenthesized.
```

### 2. Changeset Guidelines

#### Writing Good Changesets

**Do:**
- Explain the change clearly
- Include migration steps for breaking changes
- Reference issues/PRs when relevant
- Use active voice
- Be specific about impact

**Don't:**
- Use vague descriptions
- Forget to mention breaking changes
- Include implementation details
- Make assumptions about user knowledge

#### Examples

**Good:**
```markdown
---
"@goatlab/fluent": minor
---

Add support for custom query transformers

You can now register custom query transformers to modify queries before execution:

```typescript
connector.registerTransformer('addTenant', (query) => {
  return { ...query, where: { ...query.where, tenantId: 'current' } }
})
```

This enables advanced query modification patterns for multi-tenant applications.
```

**Bad:**
```markdown
---
"@goatlab/fluent": minor
---

Add transformer stuff

Added some new transformer functionality.
```

### 3. Version Bump Process

#### Automatic Versioning

```bash
# Update package versions and generate changelog
pnpm changeset version

# This will:
# - Update package.json versions
# - Generate/update CHANGELOG.md
# - Remove consumed changesets
```

#### Manual Version Review

Review generated changes:

```bash
# Check version changes
git diff package.json packages/*/package.json

# Review changelog
git diff CHANGELOG.md packages/*/CHANGELOG.md
```

### 4. Publishing Process

#### Automated Publishing

```bash
# Build and publish all packages
pnpm cs:publish

# This will:
# - Build all packages
# - Run tests
# - Publish to npm
# - Create git tags
```

#### Manual Publishing

For more control:

```bash
# Build packages
pnpm build

# Test packages
pnpm test

# Publish specific package
cd packages/fluent
npm publish

# Create git tag
git tag @goatlab/fluent@1.0.0
git push origin @goatlab/fluent@1.0.0
```

## Release Workflow

### 1. Pre-Release Preparation

#### Code Review
- [ ] All PRs reviewed and approved
- [ ] No failing tests
- [ ] Documentation updated
- [ ] Breaking changes documented

#### Quality Checks
```bash
# Run full test suite
pnpm test

# Run linting
pnpm lint

# Build all packages
pnpm build

# Check for vulnerabilities
pnpm audit
```

#### Version Planning
- [ ] Determine version bump type
- [ ] Review changesets
- [ ] Plan release timeline
- [ ] Prepare release notes

### 2. Release Execution

#### Step 1: Create Release Branch
```bash
git checkout -b release/v1.2.0
```

#### Step 2: Version Packages
```bash
# Update versions
pnpm changeset version

# Review changes
git diff

# Commit version changes
git add .
git commit -m "chore: version packages"
```

#### Step 3: Final Testing
```bash
# Run full test suite
pnpm test

# Test package installation
cd /tmp
npm init -y
npm install @goatlab/fluent@latest
```

#### Step 4: Publish Release
```bash
# Build packages
pnpm build

# Publish to npm
pnpm cs:publish

# Push tags
git push origin --tags
```

#### Step 5: Create GitHub Release
```bash
# Create GitHub release
gh release create v1.2.0 \
  --title "Release v1.2.0" \
  --notes-file CHANGELOG.md \
  --draft

# Or create manually on GitHub
```

### 3. Post-Release Tasks

#### Verification
- [ ] Packages available on npm
- [ ] Documentation updated
- [ ] Release notes published
- [ ] Tags created correctly

#### Communication
- [ ] Announce on Discord
- [ ] Update documentation site
- [ ] Send release email
- [ ] Post on social media

#### Monitoring
- [ ] Monitor error rates
- [ ] Check download statistics
- [ ] Watch for issue reports
- [ ] Monitor performance metrics

## Release Automation

### GitHub Actions Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm build

      - name: Run tests
        run: pnpm test

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm cs:publish
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        if: steps.changesets.outputs.published == 'true'
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ steps.changesets.outputs.publishedPackages[0].version }}
          release_name: Release ${{ steps.changesets.outputs.publishedPackages[0].version }}
          body: |
            ${{ steps.changesets.outputs.publishedPackages[0].changelog }}
```

### Pre-Release Automation

```yaml
# .github/workflows/pre-release.yml
name: Pre-Release

on:
  schedule:
    - cron: '0 2 * * 1' # Weekly on Monday at 2 AM

jobs:
  pre-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm build

      - name: Run tests
        run: pnpm test

      - name: Create pre-release
        run: |
          # Create beta version
          pnpm changeset version --snapshot beta
          pnpm changeset publish --tag beta
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Branch Strategy

### Main Branch
- **Purpose**: Production-ready code
- **Protection**: Requires PR approval
- **Automation**: Automatic releases

### Development Branch
- **Purpose**: Integration of new features
- **Protection**: Requires PR approval
- **Automation**: Pre-release builds

### Feature Branches
- **Purpose**: Individual feature development
- **Naming**: `feature/description`
- **Lifecycle**: Created from and merged into development

### Release Branches
- **Purpose**: Release preparation
- **Naming**: `release/v1.2.0`
- **Lifecycle**: Created from development, merged into main

### Hotfix Branches
- **Purpose**: Critical bug fixes
- **Naming**: `hotfix/description`
- **Lifecycle**: Created from and merged into main

## Release Types

### Major Release

**When**: Breaking changes, new architecture
**Process**:
1. Create migration guide
2. Update documentation
3. Announce breaking changes
4. Provide upgrade assistance

**Timeline**: 2-3 months

### Minor Release

**When**: New features, enhancements
**Process**:
1. Feature freeze
2. Beta testing
3. Documentation updates
4. Release announcement

**Timeline**: 1 month

### Patch Release

**When**: Bug fixes, security updates
**Process**:
1. Hotfix validation
2. Emergency release
3. Notification to users

**Timeline**: 1-2 weeks

## Quality Gates

### Pre-Release Checks

```bash
# Quality gate script
#!/bin/bash

echo "Running pre-release checks..."

# Test all packages
pnpm test || exit 1

# Lint all packages
pnpm lint || exit 1

# Build all packages
pnpm build || exit 1

# Security audit
pnpm audit --audit-level high || exit 1

# Check for outdated dependencies
pnpm outdated --depth 0

# Package size check
npm-check-package-size

echo "All checks passed!"
```

### Post-Release Monitoring

```typescript
// scripts/monitor-release.ts
import { checkPackageAvailability } from './utils/npm'
import { verifyDocumentationDeployment } from './utils/docs'
import { runSmokeTests } from './utils/testing'

export async function monitorRelease(version: string) {
  console.log(`Monitoring release ${version}...`)
  
  // Check npm availability
  const packagesAvailable = await checkPackageAvailability(version)
  if (!packagesAvailable) {
    throw new Error('Packages not available on npm')
  }
  
  // Verify documentation
  const docsDeployed = await verifyDocumentationDeployment(version)
  if (!docsDeployed) {
    console.warn('Documentation not yet deployed')
  }
  
  // Run smoke tests
  const smokeTestsPassed = await runSmokeTests(version)
  if (!smokeTestsPassed) {
    throw new Error('Smoke tests failed')
  }
  
  console.log('Release monitoring completed successfully')
}
```

## Rollback Strategy

### Automated Rollback

```bash
#!/bin/bash
# rollback.sh

VERSION=$1
REASON=$2

echo "Rolling back to version $VERSION"
echo "Reason: $REASON"

# Unpublish problematic version
npm unpublish @goatlab/fluent@latest

# Revert git tags
git tag -d v$VERSION
git push origin :refs/tags/v$VERSION

# Restore previous version
npm dist-tag add @goatlab/fluent@$VERSION latest

echo "Rollback completed"
```

### Manual Rollback Steps

1. **Identify Issue**: Determine severity and impact
2. **Unpublish Package**: Remove from npm registry
3. **Revert Tags**: Remove git tags
4. **Restore Previous**: Set previous version as latest
5. **Communicate**: Notify users about rollback
6. **Fix Issue**: Address root cause
7. **Re-release**: Publish corrected version

## Best Practices

### 1. Version Planning
- Plan releases in advance
- Communicate breaking changes early
- Group related changes together
- Consider user impact

### 2. Testing
- Comprehensive test coverage
- Integration testing
- Performance testing
- Security testing

### 3. Documentation
- Update changelog
- Document breaking changes
- Provide migration guides
- Update API documentation

### 4. Communication
- Release announcements
- Migration assistance
- Community feedback
- Issue tracking

### 5. Monitoring
- Package availability
- Error rates
- Performance metrics
- User feedback

This comprehensive release process ensures reliable, predictable releases while maintaining high quality and user satisfaction.