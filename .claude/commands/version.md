# Version Packages

Now you will version the packages that have been changed.

## Prerequisites

Before versioning, you MUST make sure that all tests run and that all packages build correctly:

```bash
pnpm build
pnpm test
```

**IMPORTANT**: All commands must be run from the repository root directory.

## Step 1: Check for Changes

First, check what files have been modified:

```bash
git status
git diff --name-only
```

## Step 2: Create Changeset

We use changeset for versioning. You need to create a changeset file in the `.changeset` folder.

### Manual Creation (recommended for non-interactive environments)

Create a file in `.changeset` folder with a descriptive name (e.g., `fix-gcp-tests.md`):

```bash
cat > .changeset/descriptive-name.md << 'EOF'
---
"@package-name": patch
---

Description of the change
EOF
```

**IMPORTANT**: Use the Write tool to create changeset files instead of bash heredocs, as the terminal may not handle multi-line content well.

### Version Types

- **patch**: Bug fixes, small improvements (0.0.X)
- **minor**: New features, non-breaking changes (0.X.0)
- **major**: Breaking changes (X.0.0)

### Multiple Packages Example

```md
---
'@goatlab/fluent': minor
'@goatlab/js-utils': patch
'@goatlab/node-utils': patch
---

Add new feature to fluent and update dependencies
```

## Step 3: Apply Version Changes

Once changesets are created, apply the version changes:

```bash
pnpm cs:version
```

This will:

- Update package.json files with new versions
- Update CHANGELOG.md files
- Remove consumed changeset files

## Step 4: Review Changes

Check what was changed:

```bash
git status
git diff packages/*/package.json
git diff packages/*/CHANGELOG.md
```

## Step 5: Build and Publish

Final step is to build and publish:

```bash
pnpm cs:publish
```

This will:

1. Run `pnpm build` to ensure everything builds
2. Check npm registry for existing versions
3. Publish new versions to npm
4. Create git tags for published versions

## Common Issues and Solutions

### 1. Interactive mode fails

Use manual changeset creation with the Write tool.

### 2. Private package errors

Some packages (like @goatlab/benchmarks) may require npm payment.

### 3. Version already published (E403 error)

If you see an error like:

```text
E403 403 Forbidden - You cannot publish over the previously published versions: X.X.X
```

This means the version was already published to npm.

**Solution**:

1. Create a new changeset file with a different name (use Write tool to create `.changeset/fix-description-v2.md`)

2. Run version and publish again:

```bash
pnpm cs:version
pnpm cs:publish
```

This happens when:

- A previous publish partially succeeded
- Someone else published while you were working
- You ran `cs:version` multiple times without publishing

### 4. Test failures

If tests fail, investigate and fix the root cause before proceeding with versioning. Common issues:

- **Port conflicts (EADDRINUSE)**: Fix test isolation - tests should use dynamic ports or clean up properly
- **Testcontainer timeouts**: Check Docker is running and has sufficient resources
- **Assertion failures**: Your changes may have broken something - fix the code or update tests if expectations changed

## Example Workflow

```bash
# 1. Ensure everything builds
pnpm build

# 2. Run tests - fix any failures before proceeding
pnpm test

# 3. Check changes
git status
git diff --name-only

# 4. Create changeset (use Write tool for reliability)
# Create file: .changeset/fix-description.md

# 5. Apply versions
pnpm cs:version

# 6. Review changes
git status
cat packages/node-backend/CHANGELOG.md | head -20

# 7. Publish
pnpm cs:publish

# 8. If publish fails with "already published", create new changeset and retry
# Create file: .changeset/fix-description-v2.md
pnpm cs:version
pnpm cs:publish
```

## After Publishing

The publish command automatically:

- Creates git tags for each published package
- Outputs a list of successfully published packages

You may want to:

1. Commit the version changes if not already committed
2. Push tags to remote: `git push --follow-tags`
