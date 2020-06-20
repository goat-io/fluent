FROM python:3.7-slim-buster
################################################################################
# Original Source
# https://github.com/eHealthAfrica/firebase-emulator/blob/master/Dockerfile
################################################################################

## setup container

RUN apt update

# The Firebase install scripts use sudo so we need to add it.
RUN apt install -y sudo

RUN adduser --disabled-password --gecos '' docker
RUN adduser docker sudo
RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
USER docker
RUN sudo apt update 
RUN sudo apt install -y curl git
RUN sudo mkdir /app
RUN sudo chown -R docker:docker /app
# Fix issue with JRE installation
RUN sudo mkdir -p /usr/share/man/man1
RUN curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
RUN sudo apt install -y openjdk-11-jre-headless nodejs
# Install base tools
RUN sudo npm install -g firebase-tools
WORKDIR /app
COPY ./firebase.json /app/firebase.json
COPY ./.firebaserc /app/.firebaserc

# Install gcloud commmand utilities to use default login
RUN curl -sSL https://sdk.cloud.google.com > /tmp/gcl && bash /tmp/gcl --install-dir=~/gcloud --disable-prompts

ENV PATH $PATH:~/gcloud/google-cloud-sdk/bin

# First run will download the current .jar files for firebase
RUN firebase emulators:exec --project test ls >> /dev/null

EXPOSE 4000 8080 9000