#!/bin/bash

set -x

set -eo pipefail

if [ x"$OPENSHIFT_TOKEN" != x"" ]; then
    export BRIDGE_K8S_AUTH_BEARER_TOKEN=$OPENSHIFT_TOKEN
    export BRIDGE_K8S_AUTH=bearer-token
else
    if [ -f /var/run/workshop/token ]; then
        export BRIDGE_K8S_AUTH_BEARER_TOKEN=`cat /var/run/workshop/token`
        export BRIDGE_K8S_AUTH=bearer-token
    fi
fi

exec /opt/bridge/bin/bridge
