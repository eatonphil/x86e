docker:
	docker build . -t x86e
	docker run -v ${CURDIR}/examples:/examples -it --security-opt seccomp=unconfined x86e
