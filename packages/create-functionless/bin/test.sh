#!/usr/bin/env bash

set -ue pipefail

rm -rf .test

CWD=$(pwd)

PACKAGE_NAME="create-functionless"
PACKED_NAME="${PACKAGE_NAME}.tgz"

mkdir -p .test

function test_case() {
  
  cd ${CWD}/.test
  ${CWD}/bin/$1.sh
}

function clean_up() {
  cd ${CWD}
  rm -rf .test
}

trap clean_up EXIT

# test_case test-npm

test_case test-yarn

test_case test-devx

rm -rf .test