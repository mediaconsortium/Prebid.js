import {BANNER} from '../src/mediaTypes.js'
import {registerBidder} from '../src/adapters/bidderFactory.js'
import {replaceAuctionPrice, generateUUID, isPlainObject, isArray} from '../src/utils.js'

const BIDDER_CODE = 'MediaConsortium'
const SYNC_ENDPOINT = 'https://relay.hubvisor.io/v1/sync/big'
const AUCTION_ENDPOINT = 'https://relay.hubvisor.io/v1/auction/big'
export const OPTIMIZATIONS_STORAGE_KEY = 'media_consortium_optimizations'

const SYNC_TYPES = {
  image: 'image',
  redirect: 'image',
  iframe: 'iframe'
}

export const spec = {
  version: '0.0.1',
  code: BIDDER_CODE,
  gvlid: 1112,
  supportedMediaTypes: [BANNER],
  isBidRequestValid(bid) {
    return true
  },
  buildRequests(bidRequests, bidderRequest) {
    const {
      auctionId,
      bids,
      gdprConsent: {gdprApplies = false, consentString} = {},
      ortb2: {device, site}
    } = bidderRequest
    const currentTimestamp = Date.now()
    const optimizations = getOptimizationsFromLocalStorage()

    const impressions = bids.reduce((acc, bidRequest) => {
      const {bidId, adUnitCode, mediaTypes} = bidRequest
      const optimization = optimizations[adUnitCode]

      if (optimization) {
        const {expiresAt, isEnabled} = optimization

        if (expiresAt >= currentTimestamp && !isEnabled) {
          return acc
        }
      }

      return acc.concat({id: bidId, adUnitCode, mediaTypes})
    }, [])

    if (!impressions.length) {
      return
    }

    const request = {
      id: auctionId ?? generateUUID(),
      impressions,
      device,
      site,
      user: {
        ids: {}
      },
      regulations: {
        gdpr: {
          applies: gdprApplies,
          consentString
        }
      },
      timeout: 3600,
      ts: performance.now()
    }

    const fpId = getFpIdFromLocalStorage()

    if (fpId) {
      request.user.ids['1plusX'] = fpId
    }

    const syncData = {
      gdpr: gdprApplies,
      ad_unit_codes: impressions.map(({adUnitCode}) => adUnitCode).join(',')
    }

    if (consentString) {
      syncData.gdpr_consent = consentString
    }

    return [
      {
        method: 'GET',
        url: SYNC_ENDPOINT,
        data: syncData
      },
      {
        method: 'POST',
        url: AUCTION_ENDPOINT,
        data: request
      }
    ]
  },
  interpretResponse(serverResponse, params) {
    if (!isValidResponse(serverResponse)) return []

    const end = performance.now()

    const {
      body: {
        id: auctionId,
        bids,
        optimizations,
        partners
      }} = serverResponse

    if (partners) {
      const {onePlusX, xandr} = partners

      if (xandr) {
        xandr.placements.map(({id}) => {
          sendEventToGA4('rev_Hbv_Request', {
            cookies: document.cookie,
            user_agent: navigator.userAgent,
            request_url: AUCTION_ENDPOINT,
            fpid: onePlusX.fpid,
            placement_id: id,
            auction_id: auctionId
          }, params.data.ts)
        })
      }

      if (onePlusX) {
        const opeaud = onePlusX.opeaud ?? []
        const opectx = onePlusX.opectx ?? []

        sendEventToGA4('rev_1px_Request', {
          cookies: document.cookie,
          user_agent: navigator.userAgent,
          request_url: onePlusX.url
        }, onePlusX.start)

        sendEventToGA4('rev_1px_Response', {
          execution_time: onePlusX.end - onePlusX.start,
          key_value: opeaud.concat(opectx).join(',')
        }, onePlusX.end)
      }

      if (xandr) {
        xandr.placements.map(({id, hasBid}) => {
          sendEventToGA4('rev_APX_Request', {
            cookies: document.cookie,
            user_agent: navigator.userAgent,
            request_url: xandr.url,
            fpid: onePlusX.fpid,
            placement_id: id,
            auction_id: auctionId
          }, xandr.start)

          sendEventToGA4('rev_APX_Response', {
            is_nobid: !hasBid,
            auction_id: auctionId,
            execution_time: xandr.end - xandr.start
          }, xandr.end)
        })
      }

      sendEventToGA4('rev_Hbv_Response', {
        auction_id: auctionId,
        is_nobid: bids.length === 0,
        execution_time: end - params.data.ts
      })
    }

    if (optimizations && isArray(optimizations)) {
      const currentTimestamp = Date.now()

      const optimizationsToStore = optimizations.reduce((acc, optimization) => {
        const {adUnitCode, isEnabled, ttl} = optimization

        return {
          ...acc,
          [adUnitCode]: {isEnabled, expiresAt: currentTimestamp + ttl}
        }
      }, getOptimizationsFromLocalStorage())

      localStorage.setItem(OPTIMIZATIONS_STORAGE_KEY, JSON.stringify(optimizationsToStore))
    }

    return bids.map((bid) => {
      const {
        impressionId,
        price: {cpm, currency},
        dealId,
        ad: {
          creative: {id, mediaType, size: {width, height}, markup}
        },
        ttl = 360
      } = bid

      const markupWithMacroReplaced = replaceAuctionPrice(markup, cpm)

      return {
        requestId: impressionId,
        cpm,
        currency,
        dealId,
        ttl,
        netRevenue: true,
        creativeId: id,
        mediaType,
        width,
        height,
        ad: markupWithMacroReplaced,
        adUrl: null
      }
    })
  },
  getUserSyncs(syncOptions, serverResponses) {
    if (serverResponses.length !== 2) {
      return
    }

    const [sync] = serverResponses

    return sync.body?.bidders?.reduce((acc, {type, url}) => {
      const syncType = SYNC_TYPES[type]

      if (!syncType || !url) {
        return acc
      }

      return acc.concat({type: syncType, url})
    }, [])
  }
}

registerBidder(spec)

export function getOptimizationsFromLocalStorage() {
  try {
    const storedOptimizations = localStorage.getItem(OPTIMIZATIONS_STORAGE_KEY)

    return storedOptimizations ? JSON.parse(storedOptimizations) : {}
  } catch (err) {
    return {}
  }
}

function getFpIdFromLocalStorage() {
  try {
    return window.localStorage.getItem('ope_fpid')
  } catch (err) {
    return null
  }
}

function isValidResponse(response) {
  return isPlainObject(response) &&
      isPlainObject(response.body) &&
      isArray(response.body.bids)
}

function getSessionId() {
  const gaCookie = document.cookie.split('; ').find(row => row.startsWith('_ga'));
  if (!gaCookie) return null;
  const gaParts = gaCookie.split('.');
  if (gaParts.length < 4) return null;
  return gaParts[2] + '.' + gaParts[3];
}

async function getIpAndGeoLocation() {
  if (localStorage.getItem('prebid_ip') && localStorage.getItem('prebid_geoLocation')) {
    return {ip: localStorage.getItem('prebid_ip'), geoLocation: localStorage.getItem('prebid_geoLocation')};
  }
  const ip = (await fetch('https://api.ipify.org?format=json').then(r => r.json()))?.ip
  if (!ip) return {ip: null, geoLocation: null};
  const geoLocation = (await fetch(`https://ipapi.co/${ip}/json/`).then(r => r.json()))?.country;
  localStorage.setItem('prebid_ip', ip);
  localStorage.setItem('prebid_geoLocation', geoLocation);
  return {ip, geoLocation};
}

async function sendEventToGA4(eventName, additionalPayload, customTimestamp) {
  if (!additionalPayload) {
    additionalPayload = {};
  }

  const ts = customTimestamp ? new Date(customTimestamp).toISOString() : new Date().toISOString()
  const ipAndGeoLocation = await getIpAndGeoLocation();

  gtag('get', 'G-HZ5RJ58ZF9', 'client_id', (clientId) => {
    const payload = {
      client_id: clientId,
      events: [{
        name: eventName,
        params: {
          ...additionalPayload,
          session_id: getSessionId(),
          time_stamp: ts,
          ip: ipAndGeoLocation?.ip,
          geo_location: ipAndGeoLocation?.geoLocation,
          current_url: window.location.href,
        }
      }]
    };

    console.log(`XXX Sending event (${eventName}) to GA4`, payload);

    fetch('https://www.google-analytics.com/mp/collect?measurement_id=G-HZ5RJ58ZF9&api_secret=qF3YrfxBTjmfe6sE_8aCMA', {
      mode: 'no-cors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  });
}
