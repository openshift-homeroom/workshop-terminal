FROM centos/s2i-base-centos7:latest

USER root

# Install additional common utilities.

RUN HOME=/root && \
    INSTALL_PKGS="nano python-devel python-pip bash-completion \
        bash-completion-extras cadaver jq tmux sudo buildah podman" && \
    yum install -y centos-release-scl epel-release && \
    yum -y --setopt=tsflags=nodocs install --enablerepo=centosplus $INSTALL_PKGS && \
    yum -y clean all --enablerepo='*' && \
    pip install --no-cache-dir supervisor==4.0.4 mercurial==5.0.2

# Install Python.

RUN HOME=/root && \
    INSTALL_PKGS="rh-python36 rh-python36-python-devel \
        rh-python36-python-setuptools rh-python36-python-pip \
        httpd24 httpd24-httpd-devel httpd24-mod_ssl httpd24-mod_auth_kerb \
        httpd24-mod_ldap httpd24-mod_session atlas-devel gcc-gfortran \
        libffi-devel libtool-ltdl" && \
    yum install -y centos-release-scl && \
    yum install -y --setopt=tsflags=nodocs --enablerepo=centosplus $INSTALL_PKGS && \
    rpm -V $INSTALL_PKGS && \
    # Remove centos-logos (httpd dependency) to keep image size smaller.
    rpm -e --nodeps centos-logos && \
    yum -y clean all --enablerepo='*'

# Install Java JDK, Maven and Gradle.

RUN HOME=/root && \
    INSTALL_PKGS="bc java-1.8.0-openjdk java-1.8.0-openjdk-devel" && \
    yum install -y --setopt=tsflags=nodocs --enablerepo=centosplus $INSTALL_PKGS && \
    rpm -V $INSTALL_PKGS && \
    yum -y clean all --enablerepo='*'

RUN HOME=/root && \
    (curl -s -0 http://www.us.apache.org/dist/maven/maven-3/3.6.2/binaries/apache-maven-3.6.2-bin.tar.gz | \
    tar -zx -C /usr/local) && \
    mv /usr/local/apache-maven-3.6.2 /usr/local/maven && \
    ln -sf /usr/local/maven/bin/mvn /usr/local/bin/mvn

RUN HOME=/root && \
    curl -sL -0 https://services.gradle.org/distributions/gradle-5.6.2-bin.zip -o /tmp/gradle-5.6.2-bin.zip && \
    unzip /tmp/gradle-5.6.2-bin.zip -d /usr/local/ && \
    rm /tmp/gradle-5.6.2-bin.zip && \
    mv /usr/local/gradle-5.6.2 /usr/local/gradle && \
    ln -sf /usr/local/gradle/bin/gradle /usr/local/bin/gradle

# Install OpenShift clients.

RUN curl -s -o /tmp/oc.tar.gz https://mirror.openshift.com/pub/openshift-v3/clients/3.10.176/linux/oc.tar.gz && \
    tar -C /usr/local/bin -zxf /tmp/oc.tar.gz oc && \
    mv /usr/local/bin/oc /usr/local/bin/oc-3.10.176 && \
    rm /tmp/oc.tar.gz && \
    curl -s -o /tmp/oc.tar.gz https://mirror.openshift.com/pub/openshift-v3/clients/3.11.153/linux/oc.tar.gz && \
    tar -C /usr/local/bin -zxf /tmp/oc.tar.gz oc && \
    mv /usr/local/bin/oc /usr/local/bin/oc-3.11.153 && \
    rm /tmp/oc.tar.gz && \
    curl -s -o /tmp/oc.tar.gz https://mirror.openshift.com/pub/openshift-v3/clients/4.0.22/linux/oc.tar.gz && \
    tar -C /usr/local/bin -zxf /tmp/oc.tar.gz oc && \
    mv /usr/local/bin/oc /usr/local/bin/oc-4.0.22 && \
    rm /tmp/oc.tar.gz && \
    curl -s -o /tmp/oc.tar.gz https://mirror.openshift.com/pub/openshift-v4/clients/oc/4.1/linux/oc.tar.gz && \
    tar -C /usr/local/bin -zxf /tmp/oc.tar.gz oc && \
    mv /usr/local/bin/oc /usr/local/bin/oc-4.1 && \
    ln -s /usr/local/bin/oc-4.1 /usr/local/bin/kubectl-1.13 && \
    rm /tmp/oc.tar.gz && \
    curl -s -o /tmp/oc.tar.gz https://mirror.openshift.com/pub/openshift-v4/clients/oc/4.2/linux/oc.tar.gz && \
    tar -C /usr/local/bin -zxf /tmp/oc.tar.gz oc && \
    mv /usr/local/bin/oc /usr/local/bin/oc-4.2 && \
    ln -s /usr/local/bin/oc-4.2 /usr/local/bin/kubectl-1.14 && \
    rm /tmp/oc.tar.gz && \
    curl -s -o /tmp/oc.tar.gz https://mirror.openshift.com/pub/openshift-v4/clients/oc/4.3/linux/oc.tar.gz && \
    tar -C /usr/local/bin -zxf /tmp/oc.tar.gz oc && \
    mv /usr/local/bin/oc /usr/local/bin/oc-4.3 && \
    ln -s /usr/local/bin/oc-4.3 /usr/local/bin/kubectl-1.16 && \
    rm /tmp/oc.tar.gz

RUN curl -sL -o /usr/local/bin/odo-0.0.16 https://github.com/openshift/odo/releases/download/v0.0.16/odo-linux-amd64 && \
    chmod +x /usr/local/bin/odo-0.0.16 && \
    curl -sL -o /usr/local/bin/odo-0.0.17 https://github.com/openshift/odo/releases/download/v0.0.17/odo-linux-amd64 && \
    chmod +x /usr/local/bin/odo-0.0.17 && \
    curl -sL -o /usr/local/bin/odo-0.0.18 https://github.com/openshift/odo/releases/download/v0.0.18/odo-linux-amd64 && \
    chmod +x /usr/local/bin/odo-0.0.18 && \
    curl -sL -o /usr/local/bin/odo-0.0.19 https://github.com/openshift/odo/releases/download/v0.0.19/odo-linux-amd64 && \
    chmod +x /usr/local/bin/odo-0.0.19 && \
    curl -sL -o /usr/local/bin/odo-0.0.20 https://github.com/openshift/odo/releases/download/v0.0.20/odo-linux-amd64 && \
    chmod +x /usr/local/bin/odo-0.0.20

# Install Kubernetes client.

RUN curl -sL -o /usr/local/bin/kubectl https://storage.googleapis.com/kubernetes-release/release/v1.10.0/bin/linux/amd64/kubectl && \
    mv /usr/local/bin/kubectl /usr/local/bin/kubectl-1.10.0 && \
    chmod +x /usr/local/bin/kubectl-1.10.0 && \
    curl -sL -o /usr/local/bin/kubectl https://storage.googleapis.com/kubernetes-release/release/v1.11.0/bin/linux/amd64/kubectl && \
    mv /usr/local/bin/kubectl /usr/local/bin/kubectl-1.11.0 && \
    chmod +x /usr/local/bin/kubectl-1.11.0 && \
    curl -sL -o /usr/local/bin/kubectl https://storage.googleapis.com/kubernetes-release/release/v1.12.0/bin/linux/amd64/kubectl && \
    mv /usr/local/bin/kubectl /usr/local/bin/kubectl-1.12.0 && \
    chmod +x /usr/local/bin/kubectl-1.12.0

# Common environment variables.

ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=UTF-8 \
    LC_ALL=en_US.UTF-8 \
    LANG=en_US.UTF-8 \
    PIP_NO_CACHE_DIR=off

# Install Butterfly using system Python 2.7.

COPY butterfly /opt/workshop/butterfly

RUN HOME=/opt/workshop/butterfly && \
    cd /opt/workshop/butterfly && \
    curl -s -o /tmp/get-pip.py https://bootstrap.pypa.io/get-pip.py && \
    /usr/bin/python /tmp/get-pip.py --user && \
    rm -f /tmp/get-pip.py && \
    $HOME/.local/bin/pip install --no-cache-dir --user virtualenv && \
    $HOME/.local/bin/virtualenv /opt/workshop/butterfly && \
    source /opt/workshop/butterfly/bin/activate && \
    pip install --no-cache-dir -r requirements.txt && \
    /opt/workshop/butterfly/install-fonts.sh && \
    /opt/workshop/butterfly/fixup-styles.sh && \
    rm /opt/app-root/etc/scl_enable

# Install gateway application using SCL Node.js 10.

COPY gateway /opt/workshop/gateway

RUN HOME=/opt/workshop/gateway && \
    cd /opt/workshop/gateway && \
    source scl_source enable rh-nodejs10 && \
    npm install --production && \
    chown -R 1001:0 /opt/workshop/gateway/node_modules && \
    fix-permissions /opt/workshop/gateway/node_modules

# Install mod_wsgi-express for starting Apache with WebDAV.

RUN HOME=/opt/workshop/webdav && \
    mkdir /opt/workshop/webdav && \
    cd /opt/workshop/gateway && \
    source scl_source enable rh-python36 && \
    source scl_source enable httpd24 && \
    virtualenv /opt/workshop/webdav && \
    source /opt/workshop/webdav/bin/activate && \
    pip install mod_wsgi

# Finish environment setup.

ENV BASH_ENV=/opt/workshop/etc/profile \
    ENV=/opt/workshop/etc/profile \
    PROMPT_COMMAND=". /opt/workshop/etc/profile"

COPY s2i/. /usr/libexec/s2i/

COPY bin/. /opt/workshop/bin/
COPY etc/. /opt/workshop/etc/

COPY bin/start-singleuser.sh /opt/app-root/bin/

RUN echo "auth requisite pam_deny.so" >> /etc/pam.d/su && \
    sed -i.bak -e 's/^%wheel/# %wheel/' /etc/sudoers && \
    chmod g+w /etc/passwd

RUN sed -i.bak -e 's/driver = "overlay"/driver = "vfs"/' \
      /etc/containers/storage.conf

RUN sed -i.bak \
      -e "/\[registries.search\]/{N;s/registries = \[.*\]/registries = ['docker.io', 'registry.fedoraproject.org', 'quay.io', 'registry.centos.org']/}" \
      -e "/\[registries.insecure\]/{N;s/registries = \[.*\]/registries = ['docker-registry.default.svc:5000','image-registry.openshift-image-registry.svc:5000']/}" \
      /etc/containers/registries.conf

COPY containers/libpod.conf /etc/containers/

# COPY containers/sudoers.d/ /etc/sudoers.d/

ENV BUILDAH_ISOLATION=chroot

RUN mkdir -p /opt/app-root/etc/init.d && \
    mkdir -p /opt/app-root/etc/profile.d && \
    mkdir -p /opt/app-root/etc/supervisor && \
    mkdir -p /opt/app-root/gateway/routes && \
    chown -R 1001:0 /opt/app-root && \
    fix-permissions /opt/app-root

COPY .bash_profile /opt/app-root/src/.bash_profile

RUN source scl_source enable rh-python36 && \
    virtualenv /opt/app-root && \
    source /opt/app-root/bin/activate && \
    pip install -U pip setuptools wheel && \
    pip install ansible==2.8.2 openshift==0.9.0 jmespath==0.9.4 && \
    ln -s /opt/workshop/bin/oc /opt/app-root/bin/oc && \
    ln -s /opt/workshop/bin/odo /opt/app-root/bin/odo && \
    ln -s /opt/workshop/bin/kubectl /opt/app-root/bin/kubectl && \
    chown -R 1001:0 /opt/app-root && \
    fix-permissions /opt/app-root -P

COPY profiles/. /opt/workshop/etc/profile.d/

RUN ln -s /opt/workshop/etc/supervisord.conf /etc/supervisord.conf

LABEL io.k8s.display-name="Terminal" \
      io.openshift.expose-services="10080:http" \
      io.openshift.tags="builder,butterfly" \
      io.openshift.s2i.scripts-url=image:///usr/libexec/s2i

EXPOSE 10080

USER 1001

CMD [ "/usr/libexec/s2i/run" ]
