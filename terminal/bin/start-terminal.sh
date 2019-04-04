#!/bin/bash

if [ -f /opt/workshop/envvars/terminal.sh ]; then
    set -a
    . /opt/workshop/envvars/terminal.sh
    set +a
fi

if [ -f /opt/app-root/envvars/terminal.sh ]; then
    set -a
    . /opt/app-root/envvars/terminal.sh
    set +a
fi

exec /opt/workshop/bin/start-butterfly.sh
