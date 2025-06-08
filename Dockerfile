FROM public.ecr.aws/amazonlinux/amazonlinux:2023

RUN yum install -y gcc gcc-c++ make xz-devel glibc-static libstdc++-static

COPY lambda/slippc /src/slippc
WORKDIR /src/slippc

RUN make clean || true
RUN make static