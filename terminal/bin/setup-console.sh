#!/bin/bash

set -x

set -eo pipefail

# Setup environment, including login.

. /opt/workshop/bin/setup-environ.sh

# Copy console script to shared directory.

if [ -d $TOKEN_DIRECTORY ]; then
    cp /opt/workshop/bin/start-console.sh $TOKEN_DIRECTORY
fi
