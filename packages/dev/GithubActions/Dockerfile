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

# Some of these steps require root access.
USER root

#------------------------------------------------------------------------------|
#  NODEJS
#------------------------------------------------------------------------------|
RUN curl -sL https://deb.nodesource.com/setup_14.x -o nodesource_setup.sh \
    && bash nodesource_setup.sh \
    && apt-get install -y -q nodejs 

RUN sudo npm install -g yarn

#------------------------------------------------------------------------------|
#  PYTHON
#------------------------------------------------------------------------------|
RUN apt-get update \
    && apt-get install -y -q libffi-dev python3-dev python3-pip python3-setuptools

RUN apt install curl g++ gcc autoconf automake bison libc6-dev \
        libffi-dev libgdbm-dev libncurses5-dev libsqlite3-dev libtool \
        libyaml-dev make pkg-config sqlite3 zlib1g-dev libgmp-dev \
        libreadline-dev libssl-dev jq -y

#------------------------------------------------------------------------------|
#  RUBY
#------------------------------------------------------------------------------|
RUN wget http://ftp.ruby-lang.org/pub/ruby/2.6/ruby-2.6.3.tar.gz
RUN tar -xzvf ruby-2.6.3.tar.gz

RUN cd ruby-2.6.3 && ./configure && make && make install

RUN gem install bundler:1.17.2 && gem install fastlane && gem install cocoapods


#------------------------------------------------------------------------------|
#  JAVA installation & Build tools
#------------------------------------------------------------------------------|

RUN wget -qO - "https://adoptopenjdk.jfrog.io/adoptopenjdk/api/gpg/key/public" | apt-key add -
RUN add-apt-repository --yes https://adoptopenjdk.jfrog.io/adoptopenjdk/deb/
RUN apt-get update
RUN apt-get -y install adoptopenjdk-8-hotspot=\*
ENV JAVA_HOME=/usr/lib/jvm/adoptopenjdk-8-hotspot-amd64
ENV JAVA_HOME_8_X64=/usr/lib/jvm/adoptopenjdk-8-hotspot-amd64
RUN update-java-alternatives -s /usr/lib/jvm/adoptopenjdk-8-hotspot-amd64

# INSTALL ANT
RUN apt-get install -y --no-install-recommends ant ant-optional
ENV ANT_HOME=/usr/share/ant

# INSTALL MAVEN
RUN curl -sL https://www-eu.apache.org/dist/maven/maven-3/3.6.3/binaries/apache-maven-3.6.3-bin.zip -o maven.zip
RUN unzip -d /usr/share maven.zip
RUN rm maven.zip
RUN ln -s /usr/share/apache-maven-3.6.3/bin/mvn /usr/bin/mvn
ENV ANT_HOME=/usr/share/apache-maven-3.6.3
# INSTALL GRADLE

RUN curl -sL https://services.gradle.org/distributions/gradle-6.2-all.zip -o gradleLatest.zip
RUN unzip -d /usr/share gradleLatest.zip
RUN rm gradleLatest.zip
RUN ln -s /usr/share/gradle-6.2-all/bin/gradle /usr/bin/gradle
ENV GRADLE_HOME=/usr/share/gradle
#------------------------------------------------------------------------------|
# Android Installation & SDK
#------------------------------------------------------------------------------|
RUN apt update && sudo apt install android-sdk -y
ENV ANDROID_HOME=/usr/lib/android-sdk

RUN wget -O android-sdk.zip https://dl.google.com/android/repository/sdk-tools-linux-4333796.zip
RUN mkdir /usr/local/lib/android && mkdir /usr/local/lib/android/sdk
RUN unzip android-sdk.zip -d /usr/local/lib/android/sdk
RUN rm -f android-sdk.zip
ENV ANDROID_HOME=/usr/local/lib/android/sdk

RUN sed -i "2i export JAVA_HOME=${JAVA_HOME_8_X64}" /usr/local/lib/android/sdk/tools/bin/sdkmanager
RUN /usr/local/lib/android/sdk/tools/bin/sdkmanager --list
RUN chmod -R a+rwx /usr/local/lib/android/sdk
ENV ANDROID_SDK_ROOT=/usr/local/lib/android/sdk
ENV ANDROID_HOME=/usr/local/lib/android/sdk
# Install NDK
RUN mkdir /usr/local/lib/android/ndk-bundle
RUN echo "y" | sudo /usr/local/lib/android/sdk/tools/bin/sdkmanager --install "ndk;21.0.6113669" --sdk_root=/usr/local/lib/android/sdk

RUN wget https://dl.google.com/android/repository/platform-tools-latest-linux.zip
RUN unzip \platform-tools-latest-linux.zip
RUN cp platform-tools/adb /usr/bin/adb
RUN cp platform-tools/fastboot /usr/bin/fastboot
RUN adb --version

RUN apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="$PATH:$ANDROID_HOME/emulator"
ENV PATH="$PATH:$ANDROID_HOME/tools"
ENV PATH="$PATH:$ANDROID_HOME/tools/bin"
ENV PATH="$PATH:$ANDROID_HOME/platform-tools"

#------------------------------------------------------------------------------|
# ITMSTransporter for IOS deployes
#------------------------------------------------------------------------------|
RUN apt-get update \
	&& apt-get install --yes \
		p7zip-full \
        procps \
        expect \
        tar \
	&& apt-get clean \
	&& rm -rf /var/lib/apt/lists/*

# THIS installer forces you to run it and accept the license agreement
# We use "expect" to automate the license acceptance
# https://help.apple.com/itc/transporteruserguide/#/apdAbeb95d60
COPY ./iTMSTransporter_installer_linux_2.3.0.36.sh installer.sh
COPY ./install.sh ./install
RUN chmod +x install && chmod +x installer.sh && ./install

ENV PATH="/usr/local/itms/bin:${PATH}"
#------------------------------------------------------------------------------|
# Install Google Cloud SDK
#------------------------------------------------------------------------------|
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
RUN curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -

RUN sudo apt-get update -y
# temporary downgrade google-cloud-sdk as python component has linking bugs
RUN sudo apt-get install -y google-cloud-sdk=369.0.0-0

# remove apt
RUN rm /etc/apt/sources.list.d/google-cloud-sdk.list
RUN rm /usr/share/keyrings/cloud.google.gpg /usr/share/keyrings/cloud.google.gpg~

# add repo to the apt-sources.txt
RUN echo "google-cloud-sdk https://packages.cloud.google.com/apt" >> $HELPER_SCRIPTS/apt-sources.txt


# FIX google cloud Auth problems for docker-compose
ENV CLOUDSDK_PYTHON=/usr/bin/python3
RUN pip3 install docker-compose --upgrade
#------------------------------------------------------------------------------|

ENTRYPOINT ["/entrypoint.sh"]
CMD ["./bin/Runner.Listener", "run", "--startuptype", "service"]