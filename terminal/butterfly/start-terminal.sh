#!/bin/bash

export SHELL=/bin/bash

if [ x"$JUPYTERHUB_USER" != x"" ]; then
    export PS1="[$JUPYTERHUB_USER:\w] $ "
else
    export PS1="[\w] $ "
fi

exec /bin/bash "$@"
