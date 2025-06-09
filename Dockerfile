FROM amazonlinux:2

RUN yum install -y \
    gcc gcc-c++ make xz-devel glibc-static libstdc++-static \
    yum-plugin-versionlock gcc9 gcc9-c++ \
    && alternatives --install /usr/bin/gcc gcc /usr/bin/gcc9 60 \
    && alternatives --install /usr/bin/g++ g++ /usr/bin/g++9 60

RUN mkdir -p /src/slippc
COPY slippc/ /src/slippc/
WORKDIR /src/slippc

RUN make clean || true
RUN mkdir -p build
RUN make static