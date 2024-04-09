FROM python:3.8-slim-buster
################################################################################
# Original Source
# https://github.com/eHealthAfrica/firebase-emulator/blob/master/Dockerfile
# https://github.com/firebase/emulators-codelab/tree/master/codelab-final-state/functions
################################################################################

# The Firebase install scripts use sudo so we need to add it.
RUN apt update && apt install -y sudo

RUN adduser --disabled-password --gecos '' docker
RUN adduser docker sudo
RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
USER docker

RUN sudo apt update  && sudo apt install -y curl git xz-utils curl
RUN sudo mkdir /app
RUN sudo chown -R docker:docker /app
# Fix issue with JRE installation
RUN sudo mkdir -p /usr/share/man/man1
RUN sudo apt install -y openjdk-11-jre-headless

# Install NodeJS
RUN sudo apt-get install -y gcc g++ make node-gyp
RUN curl -sL https://deb.nodesource.com/setup_20.x 565 | sudo -E bash -
RUN sudo apt-get install -y nodejs
# Install base tools
RUN sudo npm install -g firebase-tools

# Install gcloud commmand utilities to use default login
RUN curl -sSL https://sdk.cloud.google.com > /tmp/gcl && sudo bash /tmp/gcl --install-dir=/root/gcloud --disable-prompts

ENV PATH $PATH:~/gcloud/google-cloud-sdk/bin

WORKDIR /app
COPY ./firebase.json /app/firebase.json
COPY ./.firebaserc /app/.firebaserc
# First run will download the current .jar files for firebase
RUN firebase emulators:exec --project test ls >> /dev/null

# Only install packages if package.json has changed
RUN mkdir /app/functions
COPY ./functions/package.json /app/functions/package.json
RUN cd /app/functions && sudo npm install

COPY ./startfirebase.json /app/firebase.json
COPY ./firestore.indexes.json /app/firestore.indexes.json
COPY ./firestore.rules /app/firestore.rules
COPY ./firestore.rules /app/database.rules.json
COPY ./storage.rules /app/storage.rules
COPY ./functions /app/functions
COPY ./public /app/public

EXPOSE 4000 8080 8085 4400 4500 9000 5001 9099

CMD firebase emulators:start --only auth,functions,firestore,pubsub,storage,hosting,database --project ${FIRESTORE_PROJECT_NAME:-test} 