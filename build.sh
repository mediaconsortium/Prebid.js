#!/bin/bash

gulp build --modules=appnexusBidAdapter,dgkeywordRtdProvider,mediaConsortiumBidAdapter
cp build/dist/prebid.js ../adtest/main/public/hb-relay/prebid.hb.js