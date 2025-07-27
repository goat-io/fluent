Now you will version the packages that have been changed.

## Prerequisites

Before versioning, you MUST make sure that all tests run and that all packages build correctly:

```bash
pnpm build
pnpm test
```

## Step 1: Check for Changes

First, check what files have been modified:

```bash
git status
git diff --name-only
```

## Step 2: Create Changeset

We use changeset for versioning. You need to create a changeset file in the `.changeset` folder.

### Manual Creation: (recommended for non-interactive environments)

Create a file in `.changeset` folder with a descriptive name (e.g., `fix-gcp-tests.md`):

```bash
cat > .changeset/descriptive-name.md << 'EOF'
---
"@package-name": patch
---

Description of the change
EOF
```

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

## Common Issues

1. **Interactive mode fails**: Use manual changeset creation
2. **Private package errors**: Some packages (like @goatlab/benchmarks) may require npm payment
3. **Already published**: Changeset will skip packages already at that version

## Example Workflow

```bash
# 1. Ensure everything works
pnpm build
pnpm test

# 2. Check changes
git diff --name-only

# 3. Create changeset for a patch fix
cat > .changeset/fix-cloudtask-tests.md << 'EOF'
---
"@goatlab/tasks-adapter-gcp": patch
---

Improve CloudTask test reliability by adding proper environment variable checks
EOF

# 4. Apply versions
pnpm cs:version

# 5. Review and publish
git status
pnpm cs:publish
```
