#!/usr/bin/env bash

set -ue pipefail

TEST_PROJECT="test-devx"

# Use the create script to create a new project
create-functionless ${TEST_PROJECT} -t devx-experimental
cd ${TEST_PROJECT}

# Verify new project can synth
npm run synth