import {BANNER} from '../src/mediaTypes.js'
import {registerBidder} from '../src/adapters/bidderFactory.js'
import {replaceAuctionPrice, generateUUID, isPlainObject, isArray} from '../src/utils.js'

const BIDDER_CODE = 'MediaConsortium'
const RELAY_ENDPOINT = 'https://relay.hubvisor.io/v1/auction/big'

export const spec = {
  version: '0.0.1',
  code: BIDDER_CODE,
  gvlid: 1112,
  supportedMediaTypes: [BANNER],
  isBidRequestValid(bid) {
    return true
  },
  buildRequests(bidRequests, bidderRequest) {
    const {auctionId, bids, gdprConsent, ortb2: {device, site}} = bidderRequest

    const impressions = bids.map((bidRequest) => {
      const {bidId, adUnitCode, mediaTypes} = bidRequest

      return {id: bidId, adUnitCode, mediaTypes}
    })

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
          applies: gdprConsent?.gdprApplies ?? false,
          consentString: gdprConsent?.consentString
        }
      },
      timeout: 3600
    }

    const fpId = getFpIdFromLocalStorage()

    if (fpId) {
      request.user.ids['1plusX'] = fpId
    }

    return {
      method: 'POST',
      url: RELAY_ENDPOINT,
      data: request
    }
  },
  interpretResponse(serverResponse, params) {
    if (!isValidResponse(serverResponse)) return []

    const {body: {bids}} = serverResponse

    return bids.map((bid) => {
      const {
        impressionId,
        price: {cpm, currency},
        dealId,
        ad: {
          creative: {id, mediaType, size: {width, height}, markup}
        },
        ttl
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
  }
}

registerBidder(spec)

function getFpIdFromLocalStorage() {
  try {
    return window.localStorage.getItem('ope_fpid')
  } catch (error) {
    return null
  }
}

function isValidResponse(response) {
  return isPlainObject(response) &&
      isPlainObject(response.body) &&
      isArray(response.body.bids)
}
