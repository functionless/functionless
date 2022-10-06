#!/usr/bin/env bash

set -ue pipefail

TEST_PROJECT="test-project"

# Use the create script to create a new project
yarn create --offline functionless ${TEST_PROJECT}
cd ${TEST_PROJECT}

# Verify new project can synth
yarn synth