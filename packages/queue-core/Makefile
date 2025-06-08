build: SHELL:=/bin/bash
# NOW=`date '+%Y%m%d'` && echo $NOW
NOW := $(shell date '+%Y%m%d')
build.firebase:
	docker build -t \
	goatlab/firebase-emulator:latest ./src/Docker/Database/Firebase
push.firebase:
	make build.firebase && docker push goatlab/firebase-emulator:latest
	