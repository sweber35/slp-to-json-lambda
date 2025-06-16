FROM ghcr.io/sweber35/slippc-arrow-base:latest

RUN yum install -y gcc gcc-c++ make glibc-static libstdc++-static xz-devel

WORKDIR /src/slippc
COPY slippc/ /src/slippc/

RUN mkdir -p build
RUN make clean || true
RUN make static
