# Sodium Windows Installation

To start the process, we recommend using the Windows Terminal.

## Install windows terminal

[Windows Terminal](https://apps.microsoft.com/detail/9n0dx20hk701?hl=en-US&gl=US)

## Install Chocolatey

The easiest way to manage packages on Windows is with Chocolatey. To install it,
open the Windows Terminal (using PowerShell and with Admin) and run the following command:

```bash
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

## Install Node.js

Current recommended version is v22.12.0
To install Node.js, run the following command:

```bash
choco install nodejs
```

## pnpm and n Installation

Install Yarn, n, and firebase-tools globally:

```bash
npm install --global pnpm firebase
```

## Install NVM

```bash
choco install nvm -y
choco install visualstudio2022buildtools -y
```

Restart your terminal after this step

## Install the currently supported node version

```bash
nvm install 22.12.0
nvm use 22.12.0
```

This will install the latest version of Node.js.

## Install Git

To install Git, run the following command:

```bash
choco install git -y
```

This will install Git.

## Install Pulumi CLI

To install Pulumi CLI, run the following command:

```bash
choco install pulumi -y
```

This will install Pulumi CLI.

## Install Gcloud CLI

To install Gcloud CLI, run the following command:

```bash
choco install gcloudsdk -y
```

## Install Python

```bash
choco install python -y
```

## Install Dbeaver

```bash
choco install dbeaver -y
```

This will install Gcloud CLI.

## Install Docker Desktop

To install Docker Desktop, run the following command:

```bash
choco install docker-desktop -y
```

The installation takes a couple minutes, after it is done, you will have to open Docker Desktop and Accept Terms of Use

Once, you have accepted, the Docker Engine will start (wait for it! )

We recommend a full system restart and that you close the terminal and open a new one to make sure that all env variables are set.
Now you can continue with the steps in the base README.md file
