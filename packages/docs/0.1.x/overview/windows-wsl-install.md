# Sodium Windows Installation

To work with Sodium in Windows you can choose to work with WSL (Windows Subsystem for
Linux) and Ubuntu.

To start the process, we recommend using the Windows Terminal.

## Install windows terminal

[Windows Terminal](https://apps.microsoft.com/detail/9n0dx20hk701?hl=en-US&gl=US)

### Install WSL

Open the Windows Terminal with Admin Previleges and run the following command:

```bash
wsl --install
```

Make sure to select Ubuntu as the Linux distribution.

The installation process will take a few minutes and it will ask you to create a
username and password. So whenever prompted, create a username and password, and
then press enter. Make sure to remember your username and password as it will be
used for later steps.

## Configure the Ubuntu WSL

Now that you have WSL installed, you need to configure it to work with the
Ubuntu distribution. Open the Windows Terminal, and in a new tab, select the
Ubuntu distribution.

This will open a new Ubuntu terminal, connected to the WSL instance.

### Install Node.js

Let's make sure to update the Ubuntu packages and install Node.js. Follow the
steps below: Most of these commands require SUDO to run, so make sure that you
remember your password.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt-get install curl -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
nvm install 22.12.0
npm install --global yarn
```

### Install Git

Now we will need to make sure to install Git in the Ubuntu terminal. We can also
connect the Git credentials to the Windows Terminal to reuse any existing
credentials in Windows

```bash
## Install Git
sudo apt install git libz-dev libssl-dev libcurl4-gnutls-dev libexpat1-dev gettext cmake gcc
## Configure Git
git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"
```

### Install Pulumi CLI

To setup our local development environment, we need to be connected to Pulumi.
Make sure that you are part of the Pulumi organization first, then run the
following commands

```bash
# Install Pulumi CLI
curl -fsSL https://get.pulumi.com | sh

# Login to Pulumi from the consolo
pulumi login
    #[and press enter to login with browser]

```

## Install Gcloud CLI

Finally, we will install the Google Cloud CLI in the Ubuntu terminal. Run the
following commands in your terminal.

```bash
# Prerequisites
sudo apt-get install apt-transport-https ca-certificates gnupg curl jq net-tools
# Configure Google's apt repository
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list


# Finally we install the Google Cloud CLI
sudo apt-get update && sudo apt-get install google-cloud-cli
```

### Configure the Gcloud CLI

Once the CLI is installed, we need to authenticate it with the Google Cloud
Platform. Given that we are using the Ubuntu terminal, we can run the following
command to authenticate the CLI.

```bash
# Force the "manual" link following
gcloud auth login --no-launch-browser
```

Follow paste the link in your browser and authenticate yourself, paste the code
back to the terminal, to finish the authentication process.

## Install and Configure Docker Desktop

Make sure that we install the latest version of Docker Desktop. In windows,
docker desktop by default creates its own docker machine which is not compatible
with our Ubuntu instance. We just need to access the docker desktop settings and
change the default machine to the Ubuntu instance.

### Configure Docker Desktop in Ubuntu

Now that Docker Desktop is installed, we need to configure it to work with the
Ubuntu distribution. We need to allow the non-root user to run Docker commands
without sudo. Follow the steps in the following link to allow non-root access to
docker

[Docker Post Install - Linux](https://docs.docker.com/engine/install/linux-postinstall/)

After restarting the terminal make sure to run the following command

```bash
docker ps
```

It should display no running containers, but at least you should not see an
error.

## Connect VS Code to the WSL machine

Now that your Ubuntu machine is running and configured, you need to make sure
that VS uses it for coding, follow these steps to connect to it

Follow these steps to develp from the WSL machine

[VS-Code WSL](https://code.visualstudio.com/docs/remote/wsl)

From here you can access the already existing git repositories that you have
recently cloned and use them Remember that the code in your Ubuntu machine is
not directly connected to your Windows machine, they are two different
environments. Use the Ubuntu one!

### Finish up the configuration steps in the root Readme file of this project

Now go back to the Readme.md from the root of the project and finish up the
configuration
