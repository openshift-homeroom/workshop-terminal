#!/bin/bash

# Add entry to /etc/passwd file.

STATUS=0 && whoami &> /dev/null || STATUS=$? && true

if [[ "$STATUS" != "0" ]]; then
    cat /etc/passwd | sed -e "s/^default:/builder:/" > /tmp/passwd
    echo "default:x:$(id -u):$(id -g):,,,:/opt/app-root/src:/bin/bash" >> /tmp/passwd
    cat /tmp/passwd > /etc/passwd
    rm /tmp/passwd
fi

# Setup 'oc' client configuration for the location of the OpenShift cluster.

CA_FILE="/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"

if [ x"$KUBERNETES_PORT_443_TCP_ADDR" != x"" ]; then
    if [ -f $CA_FILE ]; then
        OC_CA_ARGS="--certificate-authority $CA_FILE"
    else
        OC_CA_ARGS="--insecure-skip-tls-verify"
    fi

    oc config set-cluster local $OC_CA_ARGS --server \
        "https://$KUBERNETES_PORT_443_TCP_ADDR:$KUBERNETES_PORT_443_TCP_PORT" 

    oc config set-context local --cluster local
    oc config use-context local
fi

# Try and work out the correct version of the command line tools to use
# if not explicitly defined by the template. This assumes you will be
# using the same cluster the deployment is to. We hope the above setup
# will work okay with the default 'oc' version if no version was defined
# and before we can work out the correct version to use.

if [ x"$KUBERNETES_PORT_443_TCP_ADDR" != x"" ]; then
    if [ -z "$KUBECTL_VERSION" ]; then
        KUBECTL_VERSION=`(/usr/local/bin/kubectl-1.11.0 version -o json | \
            python -c 'from __future__ import print_function; import sys, json; \
            info = json.loads(sys.stdin.read()).get("serverVersion"); \
            info and print("%s.%s" % (info["major"], info["minor"]))') || true`
    fi
fi

if [ -z "$OC_VERSION" ]; then
    case "$KUBECTL_VERSION" in
        1.10|1.10+)
            OC_VERSION=3.10
            ;;
        1.11|1.11+)
            OC_VERSION=3.11
            ;;
        1.12|1.12+)
            OC_VERSION=4.0
            ;;
        1.13|1.13+)
            OC_VERSION=4.1
            ;;
    esac
fi

if [ -z "$ODO_VERSION" ]; then
    ODO_VERSION=0.0.20
fi

export OC_VERSION
export KUBECTL_VERSION
export ODO_VERSION

# Now attempt to login to the OpenShift cluster. First check whether we
# inherited a user access token from the .kube directory via an emptydir
# volume initialised from an init container. If not, see if we have been
# passed in a username/password to use to login. Finally, see if the
# service account token has been mounted into the container.

TOKEN_DIRECTORY="/var/run/workshop"
USER_TOKEN_FILE="$TOKEN_DIRECTORY/token"
ACCT_TOKEN_FILE="/var/run/secrets/kubernetes.io/serviceaccount/token"

if [ x"$KUBERNETES_PORT_443_TCP_ADDR" != x"" ]; then
    if [ x"$OPENSHIFT_TOKEN" != x"" ]; then
        oc login $OC_CA_ARGS --token "$OPENSHIFT_TOKEN" > /dev/null 2>&1
        if [ -d $TOKEN_DIRECTORY ]; then
            echo "$OPENSHIFT_TOKEN" > $USER_TOKEN_FILE
        fi
    else
        if [ -f $USER_TOKEN_FILE ]; then
            oc login $OC_CA_ARGS --token `cat $USER_TOKEN_FILE` > /dev/null 2>&1
        else
            if [ x"$OPENSHIFT_USERNAME" != x"" -a x"$OPENSHIFT_PASSWORD" != x"" ]; then
                oc login $OC_CA_ARGS -u "$OPENSHIFT_USERNAME" -p "$OPENSHIFT_PASSWORD" > /dev/null 2>&1
                if [ -d $TOKEN_DIRECTORY ]; then
                    oc whoami --show-token > $USER_TOKEN_FILE
                fi
            else
                if [ -f $ACCT_TOKEN_FILE ]; then
                    oc login $OC_CA_ARGS --token `cat $ACCT_TOKEN_FILE` > /dev/null 2>&1
                fi
            fi
        fi
    fi
fi

# If we have been supplied the name of a OpenShift project to use, change
# to that specific project, rather than rely on default selected, and try
# and create the project if it doesn't exist.

if [ x"$OPENSHIFT_PROJECT" != x"" ]; then
    oc project "$OPENSHIFT_PROJECT" || oc new-project "$OPENSHIFT_PROJECT" > /dev/null 2>&1
fi

# If the host used in cluster subdomain for applications is not defined
# try and determine by querying the REST API. Ignore any errors.

if [ x"$CLUSTER_SUBDOMAIN" = x"" ]; then
    if [ x"$APPLICATION_NAME" = x"" ]; then
        APPLICATION_NAME=`echo $HOSTNAME | sed -e 's/-[0-9]*-[a-z0-9]*$//'`
    fi

    APPLICATION_HOST=`oc get route $APPLICATION_NAME -o template --template '{{.spec.host}}{{"\n"}}' 2>/dev/null || true`

    CLUSTER_SUBDOMAIN=`echo $APPLICATION_HOST | sed -e 's/[a-z0-9-]*\.//'`
    export CLUSTER_SUBDOMAIN
fi

# Setup WebDAV configuration for when running Apache. Done here so that
# environment variables are available to the terminal to add an account.

WEBDAV_REALM=workshop
WEBDAV_USERFILE=/opt/app-root/etc/webdav.htdigest

export WEBDAV_REALM
export WEBDAV_USERFILE

if [ ! -s $WEBDAV_USERFILE ]; then
    touch $WEBDAV_USERFILE
    if [ x"$OPENSHIFT_USERNAME" != x"" -a x"$OPENSHIFT_PASSWORD" != x"" ]; then
        DIGEST="$( printf "%s:%s:%s" "$OPENSHIFT_USERNAME" "$WEBDAV_REALM" "$OPENSHIFT_PASSWORD" | md5sum | awk '{print $1}' )"
        printf "%s:%s:%s\n" "$OPENSHIFT_USERNAME" "$WEBDAV_REALM" "$DIGEST" >> $WEBDAV_USERFILE
    fi
fi
