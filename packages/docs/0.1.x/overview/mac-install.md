# Quick Start

## Before You Start

Request the SECRETS_ENCRYPTION_KEY_DEV environment variable from your team. It's
essential for running the dev backend.

> Important: Copy the .env.example files to .env. The Backend, Infra, and
> Wordpress need the SECRETS_ENCRYPTION_KEY_DEV variable in the .env file.

## Getting Started

Our application is a Full Stack Typescript project on GCP, utilizing Node.js and
the GCloud CLI.

## HomeBrew Installation

Install HomeBrew using:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## Node Setup

Install Node.js 22.12.0:

```bash
brew install node
```

## pnpm and n Installation

Install Yarn, n, and firebase-tools globally:

```bash
npm install --global pnpm n firebase
```

Then, install Node.js version 22.12.0:

```bash
sudo n 22.12.0
```
