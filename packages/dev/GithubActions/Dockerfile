#------------------------------------------------------------------------------|
#   GITHUB RUNNER linux - Dockerfile
#------------------------------------------------------------------------------|
#
#  Resources: 
#       https://testdriven.io/blog/github-actions-docker/
#       https://github.com/actions/virtual-environments/tree/main/images/
#       linux/ scripts/installers
#  Original image: myoung34/github-runner:latest
#
FROM myoung34/github-runner:latest
ENV ImageOS=ubuntu20
ENV LANG='en_US.UTF-8' LANGUAGE='en_US:en' LC_ALL='en_US.UTF-8'

# Some of these steps require root access.
USER root

#------------------------------------------------------------------------------|
# Install Google Cloud SDK
#------------------------------------------------------------------------------|
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
RUN curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -

#------------------------------------------------------------------------------|
#  APT dependencies
#------------------------------------------------------------------------------|
RUN apt-get install software-properties-common -y -q
RUN add-apt-repository ppa:deadsnakes/ppa
RUN curl -sL https://deb.nodesource.com/setup_16.x -o nodesource_setup.sh \
    && bash nodesource_setup.sh

RUN add-apt-repository universe
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y -q \
    libffi-dev \ 
    python3.6 \
    #NODE
    nodejs \
    curl g++ gcc autoconf automake bison libc6-dev \
    libffi-dev libgdbm-dev libncurses5-dev libsqlite3-dev libtool \
    libyaml-dev make pkg-config sqlite3 zlib1g-dev libgmp-dev \
    libreadline-dev libssl-dev jq tzdata ca-certificates fontconfig locales \
    # ANT
    ant ant-optional \
    #Android SDK
    android-sdk \
    p7zip-full \
    procps \
    expect \
    tar \
    google-cloud-sdk=369.0.0-0 \
    && echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

#------------------------------------------------------------------------------|
#  RUBY
#------------------------------------------------------------------------------|
RUN wget http://ftp.ruby-lang.org/pub/ruby/2.7/ruby-2.7.6.tar.gz
RUN tar -xzvf ruby-2.7.6.tar.gz
RUN cd ruby-2.7.6 && ./configure && make && make install
RUN gem install bundler:2.1.4 && gem install fastlane && gem install cocoapods

#------------------------------------------------------------------------------|
#  YARN
#------------------------------------------------------------------------------|

RUN sudo npm install -g yarn firebase-tools

#------------------------------------------------------------------------------|
#  JAVA installation & Build tools
#------------------------------------------------------------------------------|
RUN add-apt-repository ppa:openjdk-r/ppa
RUN dpkg --add-architecture i386
RUN apt-get update \
  && apt-get -y --no-install-recommends install openjdk-8-jdk openjdk-11-jdk libc6:i386 libstdc++6:i386 libgcc1:i386 libncurses5:i386 libz1:i386 net-tools unzip \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN sudo update-alternatives --set javac /usr/lib/jvm/java-11-openjdk-amd64/bin/javac
RUN sudo update-alternatives --set java /usr/lib/jvm/java-11-openjdk-amd64/bin/java

ENV JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"
ENV PATH="${PATH}:${JAVA_HOME}"
RUN java -version && echo $JAVA_HOME

# INSTALL ANT
ENV ANT_HOME=/usr/share/ant
#------------------------------------------------------------------------------|
# Android Installation & SDK
#------------------------------------------------------------------------------|
ENV ANDROID_SDK_ROOT /opt/android-sdk-linux
ENV ANDROID_HOME /opt/android-sdk-linux

RUN cd /opt \
    && wget -q https://dl.google.com/android/repository/commandlinetools-linux-6858069_latest.zip -O android-commandline-tools.zip \
    && mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools \
    && unzip -q android-commandline-tools.zip -d /tmp/ \
    && mv /tmp/cmdline-tools/ ${ANDROID_SDK_ROOT}/cmdline-tools/latest \
    && rm android-commandline-tools.zip && ls -la ${ANDROID_SDK_ROOT}/cmdline-tools/latest/

ENV PATH ${PATH}:${ANDROID_SDK_ROOT}/platform-tools:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin

RUN (yes || true) | sdkmanager --licenses || true
RUN touch /root/.android/repositories.cfg

RUN yes | sdkmanager "tools" "platform-tools" "platforms;android-30" "build-tools;30.0.0" "ndk;21.0.6113669" || true

RUN sdkmanager --list

# Gradle PPA
ENV GRADLE_VERSION=6.7
ENV PATH=$PATH:"/opt/gradle/gradle-6.7/bin/"
RUN wget https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip -P /tmp \
    && unzip -d /opt/gradle /tmp/gradle-*.zip \
    && chmod +775 /opt/gradle \
    && gradle --version \
    && rm -rf /tmp/gradle*

RUN gradle --version
# ------------------------------------------------------
# --- Install Maven 3 from PPA

RUN apt-get update \
 && apt-get -y install maven \
 && mvn --version


RUN wget https://dl.google.com/android/repository/platform-tools-latest-linux.zip
RUN unzip \platform-tools-latest-linux.zip
RUN cp platform-tools/adb /usr/bin/adb
RUN cp platform-tools/fastboot /usr/bin/fastboot
RUN adb --version

RUN apt-get clean \
    && rm -rf /var/lib/apt/lists/*
#------------------------------------------------------------------------------|
# ITMSTransporter for IOS deployes
#------------------------------------------------------------------------------|
# THIS installer forces you to run it and accept the license agreement
# We use "expect" to automate the license acceptance
# https://help.apple.com/itc/transporteruserguide/#/apdAbeb95d60
COPY ./iTMSTransporter_installer_linux_2.3.0.36.sh installer.sh
COPY ./install.sh ./install
RUN chmod +x install && chmod +x installer.sh && ./install

ENV PATH="/usr/local/itms/bin:${PATH}"


# add repo to the apt-sources.txt
RUN echo "google-cloud-sdk https://packages.cloud.google.com/apt" >> $HELPER_SCRIPTS/apt-sources.txt


# FIX google cloud Auth problems for docker-compose
ENV CLOUDSDK_PYTHON=/usr/bin/python3
RUN pip3 install docker-compose --upgrade
#------------------------------------------------------------------------------|
ENV GRADLE_OPTS="-Dorg.gradle.jvmargs='-XX:MaxMetaspaceSize=3g'"
ENTRYPOINT ["/entrypoint.sh"]
CMD ["./bin/Runner.Listener", "run", "--startuptype", "service"]