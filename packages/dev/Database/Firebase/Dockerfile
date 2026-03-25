FROM node:22-slim

# Install base packages + ca-certificates (needed for curl to fetch Adoptium key)
RUN apt-get update && \
    apt-get install -y --no-install-recommends sudo curl git gnupg ca-certificates && \
    # Add Adoptium (Eclipse Temurin) repo for JDK 21
    curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /usr/share/keyrings/adoptium.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb $(. /etc/os-release && echo $VERSION_CODENAME) main" > /etc/apt/sources.list.d/adoptium.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends temurin-21-jre && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add a non-root user
RUN groupadd -r firebase && useradd -r -m -g firebase -s /bin/bash firebase

# Add the user to the sudo group without password prompt
RUN echo "firebase ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/nopasswd

USER firebase

# Install Firebase tools
RUN sudo npm install -g firebase-tools

WORKDIR /app

# Copy Firebase configuration files
COPY --chown=firebase:firebase firebase.json .firebaserc startfirebase.json firestore.indexes.json firestore.rules database.rules.json storage.rules /app/

# Download emulator JARs (without starting them — avoids QEMU issues in cross-arch builds)
RUN firebase setup:emulators:firestore && \
    firebase setup:emulators:database && \
    firebase setup:emulators:pubsub && \
    firebase setup:emulators:storage && \
    firebase setup:emulators:ui

# Install npm packages for functions
COPY --chown=firebase:firebase functions/package.json /app/functions/
RUN cd functions && sudo npm install

# Copy remaining files
COPY --chown=firebase:firebase functions /app/functions
COPY --chown=firebase:firebase public /app/public

EXPOSE 4000 8080 8085 4400 4500 9000 5001 9099 9199 9200 9299

# Set default command to start Firebase emulators
CMD ["firebase", "emulators:start", "--only", "auth,functions,firestore,pubsub,storage,hosting,database,hub,logging", "--project", "demo-local-test-emulator"]
