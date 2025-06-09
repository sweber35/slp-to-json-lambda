FROM public.ecr.aws/amazonlinux/amazonlinux:2023

RUN yum install -y gcc gcc-c++ make glibc-static libstdc++-static xz-devel

WORKDIR /src/slippc
COPY slippc/ /src/slippc/

RUN mkdir -p build
RUN make clean || true
RUN make static
