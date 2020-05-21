FROM python:3.7-slim-buster

################################################################################
## setup container
################################################################################
RUN apt update

# The Firebase install scripts use sudo so we need to add it.
RUN apt install -y sudo

RUN adduser --disabled-password --gecos '' docker
RUN adduser docker sudo
RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
USER docker
RUN sudo apt update 
RUN sudo apt install -y curl
# Install base tools
RUN curl -sL firebase.tools | bash
RUN sudo mkdir /app
RUN sudo chown -R docker:docker /app
# Fix issue with JRE installation
RUN sudo mkdir -p /usr/share/man/man1
RUN sudo apt install -y openjdk-11-jre-headless 
WORKDIR /app
COPY ./firebase.json /app/firebase.json
# First run will download the current .jar files.
# If on UP it's downloading new jars, we need to rebuild
RUN firebase emulators:exec ls >> /dev/null