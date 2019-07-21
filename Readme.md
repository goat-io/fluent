[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

# First time installing
```
npm run clean-install
```
# Start development

```
lerna run dev --stream --parallel
```

# Creating a new release?

```
lerna run build
git commit -m "changes"
lerna version
```
