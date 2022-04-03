FROM mongo:4.2

LABEL maintainer="Ignacio Cabrera <cabrerabywaters@gmail.com>"

################################################################
# If required, you can include your own mongo.conf
# just uncomment the next line and include
# the file into the MongoDB folder
################################################################
RUN apt-get update && apt install dos2unix -y
COPY setup.sh /docker-entrypoint-initdb.d/

RUN dos2unix /docker-entrypoint-initdb.d/setup.sh

VOLUME /data/db /data/configdb

CMD ["mongod"]

EXPOSE 27017
