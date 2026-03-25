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
		docker buildx create --use --name firebase-builder 2>/dev/null || docker buildx use firebase-builder; \
		docker buildx build \
			--platform linux/amd64,linux/arm64 \
			-t goatlab/firebase-emulator:latest \
			-t goatlab/firebase-emulator:${CURRENT_VERSION} \
			--push \
			.; \
	fi
