Workshop Terminal
=================

This repository contains software for deploying a containerised user environment in OpenShift, where users are provided access to the environment via a terminal in their web browser. It can be used to support workshops where users need access to command line clients and other tools when working with OpenShift, and you want to avoid needing to have users install anything on their own local computer.

Command line clients, tools and software stacks which are included are:

* Editors: ``vi``/``vim``, ``nano``.
* Kubernetes clients: ``kubectl``
* OpenShift clients: ``oc``, ``odo``.
* Language runtimes: ``java``, ``node.js``, ``python``, ``ruby``.

For the language runtimes, commonly used packaging tools for working with that language are also included.

Quick start instructions
------------------------

If you don't want to read about how the user environment works, nor how they can be customised to include your own additional tools, in your OpenShift project, run:

```
oc new-app https://raw.githubusercontent.com/openshift-labs/workshop-terminal/master/templates/production.json
```

This will deploy an instance of the user environment as a standalone deployment. The name of the deployment will by default be ``terminal``.

To determine the hostname assigned to the route which you need to use in the URL to access the terminal, run:

```
oc get route/terminal
```

When you access the URL for the terminal, you will if necessary be redirected to the login page for the OpenShift cluster the terminal is deployed to. You should enter your login and password for the OpenShift cluster.

After you have supplied your credentials, you will be granted access to the terminal.

Note that you will only be granted access to the terminal if your are listed as a project admin for the project the terminal is deployed to. Users of the OpenShift cluster who are members of your project but who only have edit or view access, or users who are not a collaborator of your project, will not be granted access to the terminal.

When you use the ``oc`` and ``kubectl`` command line tools from the terminal, you will already be logged into the cluster as a special service account user. You should have the same rights as a project admin for that project. If you need the full access rights of your original OpenShift user, run ``oc login`` and login as your actual user.

Creating multiple sessions
--------------------------

Whenever you access the root URL for the terminal deployment, you will be redirected to the same session each time. That is, to the sub URL path of ``/terminal/session/1``.

If you want to create multiple terminal sessions within the one user environment, create a new browser tab or window, enter in the same URL, but change ``1`` in the sub URL path to a different value. You can use any alphanumeric value for the session name, as well as dashes.

Note that although this will provide you with a separate terminal session, it is still running your shell in the same container as all other terminal sessions you create with the same terminal deployment. Seperate containers are not created.

This means you cannot use this mechanism as a means of providing access to multiple users. If you do and are using command line tools such as ``oc`` or ``kubectl``, the users will interfere with each other, as the terminal sessions share the same home directory.

If you need to provide terminal sessions to multiple users, each user should create their own deployment for the terminal, or you should use the separate multi user [terminal spawner](https://github.com/openshift-labs/workshop-jupyterhub) application.

Using persistent storage
------------------------

When working from the terminal, your home directory is ``/opt/app-root/src``. This directory is ephemeral. If the terminal instance is restarted, you will loose any files you have created and saved there.

If you need persistent storage, you will need to claim a persistent volume and mount it against the deployment at a suitable directory.

Note that if using the Python language runtime and installing additional Python packages, these are installed in a Python virtual environment located at ``/opt/app-root``. If the terminal instance is restarted, these would also be lost.

For full persistence, it would be necessary to mount a persistent volume at ``/opt/app-root``, but you would need to use an init container, or some other mechanism to populate the persistent volume with the original contents of the ``/opt/app-root`` directory in the image, prior to then mounting the persistent volume on the ``/opt/app-root`` directory.

Creating a custom image
-----------------------

As the contents of the terminal image dictates what tools you have available in the user environment, you may want to customise the image contents to add additional tools. You may also want to add content such as application source code, configuration files etc, to be used by someone in a workshop.

There are two ways you can customise the contents of the image.

The first is that the image is Source-to-Image (S2I) enabled. The image can therefore be used as an S2I builder to add additional content. In this case, because an S2I build runs as a non ``root`` user, you will not be able to install additional system packages.

To create a custom image using S2I, run:

```
oc new-build --name myterminal quay.io/openshiftlabs/workshop-terminal:master~https://github.com/yourusername/yourrepo
```

Anything in the Git repository will be copied into the ``/opt/app-root/src`` directory of the image.

If you want to run your own steps during the build phase, after the files have been copied to the ``/opt/app-root/src`` directory, supply an executable shell script in the Git repository at the location ``.workshop/build``. Add to this script the extra build steps.

If you want to have special steps run when the terminal instance is being started, supply an executable shell script in the Git repository at the location ``.workshop/setup``. Add to this script the extra steps to be run each time the container is started.

The latter setup script can be used to modify files placed into the image based on the specific user environment. Note that the script is run each time the container is started, so any actions should take that into consideration.

Once you have your custom image built, the easiest way to switch to it for an existing terminal deployment is to run:

```
oc tag myterminal:latest terminal:latest
```

Alternatively, if you have uploaded the custom terminal image to an accessible image registry, you can create a fresh deployment using the template by running:

```
$ oc new-app https://raw.githubusercontent.com/openshift-labs/workshop-terminal/master/templates/production.json \
  --param TERMINAL_IMAGE=quay.io/yourusername/youimagename:latest
```

The alternative to using an S2I build, where you need to install additional system packages, is to use a ``Dockerfile`` build. In order to integrate properly with the terminal S2I builder mechanism for build and setup steps, it is recommended you use a ``Dockefile`` containing:

```
FROM quay.io/openshiftlabs/workshop-terminal:master

USER root

COPY . /tmp/src

RUN rm -rf /tmp/src/.git* && \
    chown -R 1001 /tmp/src && \
    chgrp -R 0 /tmp/src && \
    chmod -R g+w /tmp/src

USER 1001

RUN /usr/libexec/s2i/assemble
```

Add your additional steps within the section where the ``USER`` is ``root``.

Note that if installing anything into ``/opt/app-root`` from the ``Dockefile``, ensure that ownership of the files is changed to ``1001:0`` and the ``fix-permissions`` script is run on the ``/opt/app-root`` directory. These steps ensure that a user can still properly work with and edit the files which were added as ``root``.

The resulting image created from the ``Dockerfile`` build would be used in the same way.

Using versioned images
----------------------

The URL for the template used above, is taken from the ``master`` branch of this Git repository. It is therefore bound to the most recent tagged version of the terminal image. Similarly, ``master`` was used as the tag when explaining custom builds.

As the GitFlow branching model is used, although ``master`` is only updated when a tag is made, if you want to be certain that what version you are using doesn't change, you should use a specific tag.

For the template, either make a copy of the template from ``master``, or go to GitHub, identify a specific tag, and use the URL to the template from that tag.

For the images when doing a custom build, you can find a specific tagged version by going to:

* https://quay.io/repository/openshiftlabs/workshop-terminal?tab=tags

Customising deployment
----------------------
