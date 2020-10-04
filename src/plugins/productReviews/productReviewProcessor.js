/**
 * @file        product/review processor.
 * @module      ProductReviewProcessor
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require('greenhat-util/syslog');
const Duration = require("greenhat-util/duration");
const arr = require("greenhat-util/array");
const str = require("greenhat-util/string");

/**
 * Product review processing class.
 */
class ProductReviewProcessor
{
    /**
     * Constructor.
     * 
     * @param   {object}    article     Article.
     * @param   {object}    ctx         Context.
     */
    constructor(article, ctx)
    {
        this.article = article;
        this.ctx = ctx;
    }

    /**
     * Parse an offer.
     * 
     * @param   {object}    offer   Offer object.
     * @param   {object}    prod    Product.
     * @param   {string}    key     Offer key.
     * @return  {string}            Offer string
     */
    _parseOffer(offer, prod)
    {
        // Do some sorting out, set defaults, form structures etc.
        if (!offer.priceCurrency) {
            offer.priceCurrency = this.ctx.cfg.reviewSpec.defaultCurrency;
        }

        if (!this.ctx.cfg.reviewSpec.currencies[offer.priceCurrency]) {
            syslog.error(`No currency defined for '${offer.priceCurrency}', processing key '${prod._key}'.`, this.article.relPath);
        } else {
            offer._priceCurrencyObj = this.ctx.cfg.reviewSpec.currencies[offer.priceCurrency]; 
        }

        if (typeof(offer.offeredBy) != "object") {
            offer.offeredBy = {name: offer.offeredBy};
        }

        let ids = ['mpn', 'sku'];
        for (let item of ids) {
            if (prod[item] && !offer[item]) {
                offer[item] = prod[item];
            }
        }
        
        // Now set up the offer string.

        let ret = '';

        if (offer.offeredBy) {
            if (!offer.offeredBy.url && offer.url) {
                offer.offeredBy.url = offer.url;
            }

            if (!offer.offeredBy.url || offer.priceSpecification) {
                ret += offer.offeredBy.name;
            } else {
                ret += this.ctx.link(offer.offeredBy.name, offer.offeredBy.url);
            }
        }

        if (offer.name) {
            if (offer.url) {
                ret += ': ' + this.ctx.link(offer.name, offer.url);
            } else {
                ret = ': ' + offer.name;
            }
        }

        if (offer.priceSpecification) {

            ret += '<ul class="ops">';

            for (let ps of offer.priceSpecification) {

                ret += '<li>';

                if (!ps.url && offer.url) {
                    ps.url = offer.url;
                }

                if (ps.url && ps.name) {
                    ret += this.ctx.link(ps.name, ps.url);
                } else if (ps.url) {
                    ret += this.ctx.link('Offer', ps.url)
                } else if (ps.name) {
                    ret += ps.name;
                }

                if (!ps.priceCurrency) {
                    ps.priceCurrency = offer.priceCurrency;
                }

                if (!this.ctx.cfg.reviewSpec.currencies[ps.priceCurrency]) {
                    syslog.error(`No currency defined for '${ps.priceCurrency}', processing key '${prod._key}'.`, this.article.relPath);
                } else {
                    let ob = this.ctx.cfg.reviewSpec.currencies[ps.priceCurrency]; 
                    if (ps.price == 0) {
                        ret += ' Free';
                    } else {
                        ret += ' ' + ob.symbol + ps.price;
                    }
                }

                if (ps.referenceQuantity && ps.referenceQuantity.unitCode) {
                    let xl = {
                        ANN: 'year',
                        MON: 'month'
                    }

                    if (!(ps.referenceQuantity.unitCode in xl)) {
                        syslog.warning(`Cannot deal with unitCode ${ps.referenceQuantity.unitCode} in offer.`, this.article.relPath);
                    } else {
                        ret += '/' + xl[ps.referenceQuantity.unitCode];
                    }
                }
        
                ret += '</li>';

            }

            ret += '</ul>';

        } else {
            if (offer.price != null && offer.price != undefined) {
                let p = (offer.price == 0) ? 'Free' : offer._priceCurrencyObj.symbol + offer.price;
                ret += ' ' + p;
            }
        }
        
        return ret;
    }

    /**
     * Process a review.
     * 
     * @param   {string}    key         Review key.
     */
    _processReview(key)
    {
        let rev = this.article.reviews[key];

        if (rev.ratingValue == null || rev.ratingValue == undefined) {
            syslog.warning(`Reviews should have a ratingValue (${key}).`, this.article.relPath);
        }
        if (!rev.description) {
            syslog.advice(`Reviews are better with a description (${key}),`, this.article.relPath);
        }

        if (!rev.bestRating) {
            if (this.ctx.cfg.reviewSpec.bestRating) {
                rev.bestRating = this.ctx.cfg.reviewSpec.bestRating;
            } else {
                rev.bestRating = 5;
            }
        }

        if (!rev.worstRating) {
            if (this.ctx.cfg.reviewSpec.worstRating) {
                rev.worstRating = this.ctx.cfg.reviewSpec.worstRating;
            } else {
                rev.worstRating = 0;
            }
        }

        if (!rev.reviewCount) {
            rev.reviewCount = 1;
        }

        if (!rev.ratingCount) {
            rev.ratingCount = 1;
        }

        if (rev.ratingValue != null && rev.ratingValue != undefined) {

            rev._ratingStr = rev.ratingValue + ' out of ' + rev.bestRating;

            if (this.ctx.cfg.reviewSpec.ratings.wantStars) {
                let stars = '';

                let intgr = Math.floor(rev.ratingValue);
                let blanks = rev.bestRating - intgr;
                let half = false;
                if (rev.ratingValue - intgr != 0) {
                    half = true;
                    blanks--;
                }
                for (let i = 0; i < intgr; i++) {
                    let params = {
                        url: this.ctx.cfg.reviewSpec.ratings.stars.full,
                        alt: "Rating star."
                    }
                    stars += this.ctx.img(params, rev._ratingStr);
                }
                if (half) {
                    let params = {
                        url: this.ctx.cfg.reviewSpec.ratings.stars.half,
                        alt: "Rating half star."
                    }
                    stars += this.ctx.img(params, rev._ratingStr);
                }
                for (let i = 0; i < blanks; i++) {
                    let params = {
                        url: this.ctx.cfg.reviewSpec.ratings.stars.none,
                        alt: "Rating star."
                    }
                    stars += this.ctx.img(params, rev._ratingStr);
                }

                rev._ratingStars = stars;
            }

            if (this.ctx.cfg.reviewSpec.ratings.alts && this.ctx.cfg.reviewSpec.ratings.alts[rev.ratingValue]) {
                let rs = this.ctx.cfg.reviewSpec.ratings.alts[rev.ratingValue];
                let cls = 'rating-string ' + str.slugify(rs);
                rev._ratingStr += ': <span class="' + cls + '">' + rs + '</span>';
            }

            if (rev._ratingStars && rev._ratingStars != '') {
                rev._ratingStr += '&nbsp;&nbsp;&nbsp;<span class="stars">' + rev._ratingStars + '</span>';
            }
        }

        if (this.ctx.reviews[key]) {
            syslog.warning(`Review '${key}' already exists and will be overwritten.`, this.article.relPath);
        }

        this.ctx.reviews[key] = rev; 
    }
    
    /**
     * Do the processing.
     */
    process()
    {
        let prodArr = [];
        if (this.article.products) {
            prodArr.push('products');
        }
        if (this.article.productRefs) {
            prodArr.push('productRefs');
        }
    
        for (let rr of prodArr) {
    
            if (this.article[rr]) {
    
                for (let prodKey in this.article[rr]) {
                    let prod = this.article[rr][prodKey];
    
                    let ma = ['operatingSystem', 'applicationCategory', 'genre', 'category', 'version', 
                        'actor', 'director', 'performer'];
                    for (let ind of ma) {
                        if (prod[ind]) {
                            prod[ind] = arr.makeArray(prod[ind]);
                        }
                    }

                    prod._key = prodKey;
   
                    // No review switch?
                    let noReview = false;
                    if (this.article._noReview) {
                        noReview = this.article._noReview;
                    }
    
                    // Review?
                    let hasReview = false;
    
                    if (rr == 'productRefs') {
                        if (!noReview && (this.article.reviewRefs[prodKey] || this.ctx.reviews[prodKey])) {
                            hasReview = true;
                            if (!this.ctx.reviews[prodKey]) {
                                this._processReview(prodKey);
                            }
                        }
                    } else {
                        if (!noReview && (this.article.reviews[prodKey] || this.ctx.reviews[prodKey])) {
                            hasReview = true;
                            if (!this.ctx.reviews[prodKey]) {
                                this._processReview(prodKey);
                            }
                        }
                    }
    
                    // Type.
                    if (!prod.type) {
                        syslog.warning(`No product type specified (${prodkey}). Will use default.`, this.article.relPath);
                        prod.type = 'Product';
                    }
    
                    // Name.
                    if (!prod.name) {
                        syslog.warning(`Products should have a name (${prodKey}).`, this.article.relPath);
                    }
    
                    // URL.
                    if (prod.url) {
                        prod.urlStr = this.ctx.link("Product URL", prod.url);
                    }
                    
                    // Brand, production company, creator.
                    for (let ind of ['brand', 'creator', 'productionCompany']) {
                        if (prod[ind]) {
                            if (prod[ind].url && prod[ind].name) {
                                prod._brandLink = this.ctx.link(prod[ind].name, prod[ind].url);
                            } else if (prod[ind].url) {
                                prod._brandLink = this.ctx.link(prod[ind].url, prod[ind].url);
                            } else if (prod[ind].name) {
                                prod._brandLink = prod[ind].name;
                            } else {
                                prod._brandLink = prod[ind];
                            }
                        }                                                    
                    }
    
                    // People: Actors, directors, performers.
                    for (let arr of ['actor', 'director', 'performer']) {
                        if (prod[arr]) {
                            let fldName = '_' + arr + 'Str';
                            let result = ''; 
                            for (let item of prod[arr]) {
                                if (typeof(item) !== "object") {
                                    item = {name: item};
                                }
                                if (result != '') result += ', ';
                                if (item.sameAs) {
                                    result += this.ctx.link(item.name, item.sameAs);
                                } else if (item.url) {
                                    result += this.ctx.link(item.name, item.url);
                                } else {
                                    result += item.name;
                                }
                            }
                            prod[fldName] = result;
                        }
                    }

                    // Duration.
                    if (prod.duration) {
                        prod._durationObj = new Duration(prod.duration);
                        prod.duration = prod._durationObj.pt;
                    }

                    // Same as.
                    if (prod.sameAs) {
                        prod.sameAs = arr.makeArray(prod.sameAs);
                        let str = '';
                        for (let item of prod.sameAs) {
                            if (item.includes('imdb.com')) {
                                if (str != '') str += ', ';
                                str += this.ctx.link('IMDB', item);
                            } else if (item.includes('wikipedia.org')) {
                                if (str != '') str += ', ';
                                str += this.ctx.link('Wikipedia', item);
                            } else {
                                if (str != '') str += ', ';
                                str += this.ctx.link(item, item);
                            }
                        }
                        prod._sameAsStr = str;
                    }
    
                    // Local business.
                    if (prod.type == 'LocalBusiness') {
                        // Map.
                        if (prod.map) {
                            prod.mapLink = this.ctx.link('Map Link', prod.map);
                        }
                    }
    
                    // Event.
                    if (prod.type == 'Event') {
                        if (!prod.eventAttendanceMode) {
                            prod.eventAttendanceMode = 'Offline';
                        }
                        if (!prod.eventStatus) {
                            prod.eventStatus = 'Scheduled';
                        }
                    }
    
                    // MPN & SKU.
                    if (prod.mpn && !prod.sku) {
                        prod.sku = prod.mpn;
                    }
                    if (prod.sku && !prod.mpn) {
                        prod.mpn = prod.sku;
                    }
    
                    // Offers.
                    if (prod.offers) {
                        let offersArr = [];
                        if (prod.offers.offeredBy || prod.offers.price || prod.offers.url) {
                            let o = this._parseOffer(prod.offers, prod);
                            offersArr.push(o);
                        } else {
                            for (let offerObj of prod.offers) {
                                let o = this._parseOffer(offerObj, prod)
                                offersArr.push(o);
                            }
                        }
                        if (offersArr.length == 1) {
                            prod._offersStr = offersArr[0];
                        } else {
                            prod._offersStr = '<div class="offerblock">' + offersArr.join('<br />') + '</div>';
                        }
                    }
    
                    this.ctx.products[prodKey] = prod;

                }
            }
        }
    
    }
}

module.exports = ProductReviewProcessor;
