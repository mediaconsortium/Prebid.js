# Media Consortium Bid adapter

## Overview

```
- Module Name: MediaConsortium Bidder Adapter
- Module Type: MediaConsortium Bidder Adapter
- Maintainer: __SUPPORT_EMAIL__
```

## Description

Module that connects to Media Consortium demand sources and supports the following media types: `banner`, `video`.

To get acces to the full feature set of the adapter you'll need to allow localstorage access in the `bidderSettings`.

```javascript
    pbjs.bidderSettings = {
        MediaConsortium: {
            storageAllowed: true
        }
    }
```

## Controlling 1plusX profile API usage and FPID retrieval

You can use the `setBidderConfig` function to enable or disable 1plusX profile API usage and fpid retrieval.

If the keys found below are not defined, their values will default to `false`.

```javascript
    pbjs.setBidderConfig({
        bidders: ['MediaConsortium'],
        config: {
            // Controls the 1plusX profile API usage
            useProfileApi: true,
            // Controls the 1plusX fpid retrieval
            readOnePlusXId: true
        }
    });
```

## Test Parameters

```javascript
    var adUnits = [
        {
            code: 'div-prebid-banner',
            mediaTypes:{
                banner: {
                    sizes: [[300, 250]],
                }
            },
            bids:[
                {
                    bidder: 'mediaConsortium',
                    params: {}
                }
            ]
        },
        {
            code: 'div-prebid-video',
            mediaTypes:{
                video: {
                    playerSize: [
                        [300, 250]
                    ],
                    context: 'outstream'
                }
            },
            bids:[
                {
                    bidder: 'mediaConsortium',
                    params: {}
                }
            ]
        }
    ];
```
