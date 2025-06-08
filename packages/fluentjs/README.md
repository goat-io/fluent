<!-- PROJECT SHIELDS -->

[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/github_username/repo">
       <img src="https://docs.goatlab.io/logo.png" alt="Logo" width="150" height="150">
  </a>

  <h3 align="center">GOAT-FLUENT</h3>

  <p align="center">
    Readable query Interface & API generator
    <br />
    <a href="https://docs.goatlab.io/#/0.5.x/fluent/fluent"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://codesandbox.io/s/goat-nestjs-tytmv?file=/src/main.ts">View Demo</a>
    ·
    <a href="https://github.com/goat-io/fluent/issues">Report Bug</a>
    ·
    <a href="https://github.com/goat-io/fluent/issues">Request Feature</a>
  </p>
</p>

# Goat - Fluent

Fluent query interface for Multiple database types and helpers for fast API generation and general App building.

## Supported Databases

1. Firebase\*\*
2. MongoDB\*
3. Mysql\*
4. MariaDB\*
5. SQLite\*
6. Postgres\*
7. CockroachDB\*
8. Microsoft SQL Server\*
9. Oracle\*
10. SAP Hana\*
11. sql.js\*
12. LokiJS
13. In-memory

Wrapper for TypeORM \*

### Installing

To install this package in your project, you can use the following command within your terminal.

```bash
npm install --global @goatlab/fluent
```

### Documentation

To learn how to use this visit the [Goat Docs](https://docs.goatlab.io/#/0.5.x/fluent/fluent)

<!--

Packages that we need to replace
npm-pack-zip
@commitlint/prompt-cli
react-native
multer-google-storage
nestjs-typed-dynamodb
-->

## Roadmap

See the [open issues](https://github.com/github_username/repo/issues) for a list of proposed features (and known issues).

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

We use a few tools to help with code styling, pre-commits, versioning, changelog and releases.

- [Pretty-quick](https://github.com/azz/pretty-quick)
- [Husky](https://github.com/typicode/husky)
- [Auto-changelog](https://github.com/CookPete/auto-changelog)
- [Release-it](https://github.com/release-it/release-it)

All of these should run out of the box with your dev dependencies

1. If you have an issue assigned, please include the issue code/id in the beginning of you commits.
2. Include the issue id also at the start of your PR message.
3. Fork the Project
4. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
5. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
6. Push to the Branch (`git push origin feature/AmazingFeature`)
7. Open a Pull Request

## Release Process

1. All PRs will be merge directly into Master. (If test are green)
2. Once we are ready to create a release, we will locally pull the latest master version and run the release process

If patch release

```
npm run release
```

If minor release

```
npm run release:minor
```

If mayor release

```
npm run release:mayor
```

This will start the release scripts including:

- Local tests
- Final version building
- Final release zip
- Tag
- Release
- Push

## Continuous Deployment

Continuous deployment is optional. We will trigger a deployment with every published release. The equivalent trigger in Github Actions is:

```yml
on:
  release:
    types: [published]
```

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE` for more information.

<!-- CONTACT -->

## Contact

Ignacio Cabrera - [@twitter_handle](https://twitter.com/cabrerabywaters) - <ignacio.cabrera@goatlab.io>

<!-- ACKNOWLEDGEMENTS -->

## Acknowledgements

- [Tomas Castro]()
- []()
- []()

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[stars-shield]: https://img.shields.io/github/stars/goat-io/fluent?style=flat-square
[stars-url]: https://github.com/goat-io/fluent/stargazers
[issues-shield]: https://img.shields.io/github/issues/goat-io/fluent?style=flat-square
[issues-url]: https://github.com/goat-io/fluent/issues
[license-shield]: https://img.shields.io/github/license/goat-io/fluent?style=flat-square
[license-url]: https://github.com/goat-io/fluent/blob/master/LICENSE.txt
