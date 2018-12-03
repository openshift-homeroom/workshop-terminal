#!/bin/bash

set -eo pipefail

set -x

URI_ROOT_PATH=/terminal
export URI_ROOT_PATH

if [ x"$JUPYTERHUB_SERVICE_PREFIX" != x"" ]; then
    URI_ROOT_PATH=${JUPYTERHUB_SERVICE_PREFIX%/}/terminal
fi

# Now execute the program. We need to supply a startup script for the
# shell to setup the environment.

MOTD_FILE=motd

if [ -f /opt/workshop/etc/motd ]; then
    MOTD_FILE=/opt/workshop/etc/motd
fi

if [ -f /opt/app-root/etc/motd ]; then
    MOTD_FILE=/opt/app-root/etc/motd
fi

cd /opt/workshop/butterfly

exec /opt/workshop/butterfly/bin/butterfly.server.py --port=8081 \
    --host=0.0.0.0 --uri-root-path="$URI_ROOT_PATH" --unsecure \
    --i-hereby-declare-i-dont-want-any-security-whatsoever \
    --shell=/opt/workshop/butterfly/start-terminal.sh --motd=$MOTD_FILE
