import { expect } from 'chai';
import { spec } from 'modules/mediaConsortiumBidAdapter.js';

describe('Media Consortium Bid Adapter', function () {
  describe('buildRequests', function () {
    it('should build request (banner)', function () {
      const bids = [{
        adUnitCode: 'dfp_ban_atf',
        bidId: '2f0d9715f60be8',
        mediaTypes: {
          banner: {sizes: [[300, 250]]}
        }
      }];
      const bidderRequest = {
        auctionId: '98bb5f61-4140-4ced-8b0e-65a33d792ab8',
        bids,
        ortb2: {
          device: {
            w: 1102,
            h: 999,
            dnt: 0
          },
          site: {
            page: 'http://localhost.com',
            domain: 'localhost.com'
          }
        }
      };
      const builtBidRequest = {
        id: '98bb5f61-4140-4ced-8b0e-65a33d792ab8',
        impressions: [{
          id: '2f0d9715f60be8',
          adUnitCode: 'dfp_ban_atf',
          mediaTypes: {
            banner: {sizes: [[300, 250]]}
          }
        }],
        device: {
          w: 1102,
          h: 999,
          dnt: 0
        },
        site: {
          page: 'http://localhost.com',
          domain: 'localhost.com'
        },
        user: {
          ids: {}
        },
        regulations: {
          gdpr: {
            applies: false,
            consentString: undefined
          }
        },
        timeout: 3600
      }

      const request = spec.buildRequests(bids, bidderRequest);

      expect(request.data).to.deep.equal(builtBidRequest)
    })
  })

  describe('interpretResponse', function () {
    it('should return an empty array if the response is invalid', function () {
      expect(spec.interpretResponse({body: 'INVALID_BODY'}, {})).to.deep.equal([]);
    })

    it('should return a formatted bid', function () {
      const serverResponse = {
        body: {
          id: 'requestId',
          bids: [{
            impressionId: '2f0d9715f60be8',
            price: {
              cpm: 1,
              currency: 'JPY'
            },
            dealId: 'TEST_DEAL_ID',
            ad: {
              creative: {
                id: 'CREATIVE_ID',
                mediaType: 'banner',
                size: {width: 320, height: 250},
                markup: '<html><body><div>${AUCTION_PRICE}</div></body></html>'
              }
            },
            ttl: 3600
          }]
        }
      }

      const formattedBid = {
        requestId: '2f0d9715f60be8',
        cpm: 1,
        currency: 'JPY',
        dealId: 'TEST_DEAL_ID',
        ttl: 3600,
        netRevenue: true,
        creativeId: 'CREATIVE_ID',
        mediaType: 'banner',
        width: 320,
        height: 250,
        ad: '<html><body><div>1</div></body></html>',
        adUrl: null
      }

      expect(spec.interpretResponse(serverResponse, {})).to.deep.equal([formattedBid]);
    })
  });
});
