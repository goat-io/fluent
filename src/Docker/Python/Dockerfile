FROM frolvlad/alpine-python-machinelearning

MAINTAINER cabrerabywaters@gmail.com

RUN apk add --no-cache --virtual=build_dependencies python3-dev musl-dev gcc make cmake g++ gfortran libstdc++ libffi-dev openssl-dev libxml2-dev xmlsec-dev && \
  ln -s /usr/include/locale.h /usr/include/xlocale.h

WORKDIR /srv/scrapers

COPY ./requirements.txt .

RUN pip3 install --upgrade pip
RUN pip3 install -r requirements.txt

COPY . .

CMD python3 index.py
