FROM debian:unstable

RUN apt update -y && apt install build-essential emacs gdb nasm -y
