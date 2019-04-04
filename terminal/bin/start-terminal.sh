#!/bin/bash

if [ -f /opt/app-root/envvars/terminal_envvars.sh ]; then
    set -a
    . /opt/app-root/envvars/terminal_envvars.sh
    set +a
fi

exec /opt/workshop/bin/start-butterfly.sh
