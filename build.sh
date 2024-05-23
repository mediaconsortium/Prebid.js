#!/bin/bash

gulp build --modules=appnexusBidAdapter,dgkeywordRtdProvider
cp build/dist/prebid.js ../../adtest/main/public/hb-relay/
