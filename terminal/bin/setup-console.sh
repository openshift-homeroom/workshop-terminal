#!/bin/bash

TOKEN_DIRECTORY="/var/run/workshop"

if [ -d $TOKEN_DIRECTORY ]; then
    cp /opt/workshop/bin/start-console.sh $TOKEN_DIRECTORY
fi
