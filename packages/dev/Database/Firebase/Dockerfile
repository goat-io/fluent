FROM python:3.8-slim-buster

# Update and install required packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends sudo curl git openjdk-11-jre-headless && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add a non-root user
RUN useradd -m -s /bin/bash docker

# Add the user to the sudo group without password prompt
RUN echo "docker ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/nopasswd

USER docker

# Install NodeJS
RUN curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash - && \
    sudo apt-get install -y nodejs

# Install Firebase tools
RUN sudo npm install -g firebase-tools

# Install gcloud command utilities
RUN curl -sSL https://sdk.cloud.google.com > /tmp/gcl && \
    bash /tmp/gcl --install-dir=/home/docker/google-cloud-sdk --disable-prompts

# Set Python version for Google Cloud SDK
ENV CLOUDSDK_PYTHON=python3

ENV PATH $PATH:/home/docker/google-cloud-sdk/bin

WORKDIR /app

# Copy Firebase configuration files
COPY firebase.json .firebaserc startfirebase.json firestore.indexes.json firestore.rules database.rules.json storage.rules /app/

# First run will download the current .jar files for firebase
RUN firebase emulators:exec --project test ls >> /dev/null

# Install npm packages for functions
COPY functions/package.json  /app/functions/
RUN cd functions && sudo npm install

# Copy remaining files
COPY functions /app/functions
COPY public /app/public

EXPOSE 4000 8080 8085 4400 4500 9000 5001 9099

# Set default command to start Firebase emulators
CMD ["firebase", "emulators:start", "--only", "auth,functions,firestore,pubsub,storage,hosting,database,hub,logging", "--project", "demo-local-test-emulator"]
