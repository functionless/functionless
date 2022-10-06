#!/usr/bin/env bash

set -ue pipefail

rm -rf .test

CWD=$(pwd)

PACKAGE_NAME="create-functionless"
PACKED_NAME="${PACKAGE_NAME}.tgz"
TEST_ROOT=".test"

npm run release
npm pack
mv ${PACKAGE_NAME}*.tgz ${PACKED_NAME}
npm i -g ${PACKED_NAME}

mkdir -p $TEST_ROOT
cd $TEST_ROOT

function test_case() {
  cd ${CWD}
  cd ${TEST_ROOT}
  ${CWD}/bin/$1.sh
}

function clean_up() {
  cd ${CWD}
  rm -rf ${TEST_ROOT}
}

trap clean_up EXIT

test_case test-npm

test_case test-yarn

test_case test-devx

rm -rf .test