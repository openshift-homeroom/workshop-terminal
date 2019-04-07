#!/bin/bash

cat << EOF >> /opt/workshop/butterfly/lib/python2.7/site-packages/butterfly/static/main.css

@supports (-webkit-overflow-scrolling: touch) {
    html, body {
        height: 100%;
        overflow: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
    }
}}
EOF
