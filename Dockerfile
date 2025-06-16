# --------------------------------------------
# Stage 1: Build and install Arrow & Parquet
# --------------------------------------------
FROM public.ecr.aws/amazonlinux/amazonlinux:2023 AS arrow-build

RUN yum install -y \
  gcc gcc-c++ make cmake ninja-build git \
  glibc-static libstdc++-static \
  xz-devel zlib-devel bzip2-devel lz4-devel \
  boost-devel libzstd pkgconf-pkg-config

# Build Arrow
RUN git clone --depth=1 --branch apache-arrow-14.0.1 https://github.com/apache/arrow.git && \
    mkdir -p arrow/cpp/build && cd arrow/cpp/build && \
    cmake .. -GNinja \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX=/arrow-install \
      -DARROW_PARQUET=ON \
      -DARROW_WITH_ZSTD=ON \
      -DARROW_WITH_LZ4=ON \
      -DARROW_WITH_BZ2=ON \
      -DARROW_WITH_LZMA=ON \
      -DARROW_BUILD_SHARED=ON && \
    ninja && ninja install

# --------------------------------------------
# Stage 2: Final build using prebuilt Arrow
# --------------------------------------------
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

RUN yum install -y gcc gcc-c++ make cmake glibc-static libstdc++-static xz-devel

# Copy Arrow from build stage
COPY --from=arrow-build /arrow-install /usr/local

# Build project
WORKDIR /src/slippc
COPY slippc/ /src/slippc/
RUN mkdir -p build
RUN make clean || true
RUN make static
