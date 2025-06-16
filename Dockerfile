FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Install build tools and Arrow dependencies
RUN yum install -y \
  gcc gcc-c++ make cmake ninja-build git \
  glibc-static libstdc++-static \
  xz-devel zlib-devel bzip2-devel zstd-devel \
  lz4-devel boost-devel

# Build and install Apache Arrow C++ with Parquet support
RUN git clone --depth=1 --branch apache-arrow-14.0.1 https://github.com/apache/arrow.git && \
    mkdir -p arrow/cpp/build && cd arrow/cpp/build && \
    cmake .. -GNinja \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX=/usr/local \
      -DARROW_PARQUET=ON \
      -DARROW_WITH_ZSTD=ON \
      -DARROW_WITH_LZ4=ON \
      -DARROW_WITH_BZ2=ON \
      -DARROW_WITH_LZMA=ON \
      -DARROW_BUILD_SHARED=ON && \
    ninja && ninja install && cd / && rm -rf arrow

# Copy project files
WORKDIR /src/slippc
COPY slippc/ /src/slippc/

# Optional: clean build dir
RUN mkdir -p build

# Build
RUN make clean || true
RUN make static