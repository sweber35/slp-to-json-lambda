FROM ubuntu:20.04

RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    make \
    libstdc++-static

WORKDIR /src/slippc
COPY slippc/ /src/slippc/

RUN mkdir -p build
RUN make clean || true
RUN make static