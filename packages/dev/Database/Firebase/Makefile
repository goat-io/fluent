build: SHELL:=/bin/bash

define GetFromPkg
$(shell node -p "require('./package.json').$(1)")
endef
CURRENT_VERSION:= $(call GetFromPkg,version)
BRANCH:="$(shell git rev-parse --abbrev-ref HEAD)"
NOW := $(shell date '+%Y%m%d')

publish:
	@if [ "${BRANCH}" != "master" ]; then \
		echo "Not in branch master, nothing to do" && exit 0; \
	else \
		git pull origin master; \
		echo "version ${CURRENT_VERSION}"; \
		DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build --build-arg BUILDKIT_INLINE_CACHE=1 firestore; \
		docker tag goatlab/firebase-emulator goatlab/firebase-emulator:latest; \
		docker tag goatlab/firebase-emulator goatlab/firebase-emulator:${CURRENT_VERSION}; \
		docker push goatlab/firebase-emulator:latest; \
		docker push goatlab/firebase-emulator:${CURRENT_VERSION}; \
		docker compose build --build-arg BUILDKIT_INLINE_CACHE=1 firestore; \
		docker tag goatlab/firebase-emulator goatlab/firebase-emulator:latest-arm64; \
		docker tag goatlab/firebase-emulator goatlab/firebase-emulator:${CURRENT_VERSION}-arm64; \
		docker push goatlab/firebase-emulator:latest-arm64; \
		docker push goatlab/firebase-emulator:${CURRENT_VERSION}-arm64; \
	fi