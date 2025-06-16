FROM ghcr.io/sweber35/slippc-arrow-base:latest

RUN yum install -y make

WORKDIR /src/slippc
COPY slippc/ /src/slippc/

RUN mkdir -p build

ENV CPLUS_INCLUDE_PATH=/usr/local/include
ENV LIBRARY_PATH=/usr/local/lib

RUN make clean || true
RUN make static
