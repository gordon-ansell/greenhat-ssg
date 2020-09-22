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
     * Process an offer.
     * 
     * @param   {object}    offer   Offer object.
     * @param   {object}    prod    Product.
     * @param   {string}    key     Offer key.
     * @return  {string}            Offer string
     */
    _processOffer(offer, prod, key = null)
    {
        let ret = '';

        if (key) {
            ret += key + ': ';
        }

        let ids = ['mpn', 'sku'];
        for (let item of ids) {
            if (prod[item] && !offer[item]) {
                offer[item] = prod[item];
            }
        }

        if (offer.from) {
            if (!offer.url) {
                syslog.advice("Offers with a 'from' should also have a 'url'.", this.article.relPath);
                ret += offer.from;
            } else {
                ret += this.ctx.link(offer.from, offer.url);
            }
        }

        if (!offer.availability) {
            offer.availability = "InStock";
        }

        if (!offer.priceValidUntil) {
            let d = new Date();
            d.setFullYear(d.getFullYear() + 1)
            offer.priceValidUntil = d.toISOString();
        }

        if (!offer.priceCurrency) {
            offer.priceCurrency = this.ctx.cfg.reviewSpec.defaultCurrency;
        }

        if (!this.ctx.cfg.reviewSpec.currencies[offer.priceCurrency]) {
            syslog.error(`No currency defined for '${offer.priceCurrency}'.`, this.article.relPath);
        } else {
            offer.priceCurrency = this.ctx.cfg.reviewSpec.currencies[offer.priceCurrency]; 
        }

        if (offer.price) {
            ret += ' ' + offer.priceCurrency.symbol + offer.price;
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

        if (rev.rating == null || rev.rating == undefined) {
            syslog.warning(`Reviews should have a rating (${key}).`, this.article.relPath);
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

        if (rev.rating != null && rev.rating != undefined) {

            rev.ratingStr = rev.rating + ' out of ' + rev.bestRating;

            if (this.ctx.cfg.reviewSpec.ratings.wantStars) {
                let stars = '';

                let intgr = Math.floor(rev.rating);
                let blanks = rev.bestRating - intgr;
                let half = false;
                if (rev.rating - intgr != 0) {
                    half = true;
                    blanks--;
                }
                for (let i = 0; i < intgr; i++) {
                    let params = {
                        url: this.ctx.cfg.reviewSpec.ratings.stars.full,
                        alt: "Rating star."
                    }
                    stars += this.ctx.img(params, rev.ratingStr);
                }
                if (half) {
                    let params = {
                        url: this.ctx.cfg.reviewSpec.ratings.stars.half,
                        alt: "Rating half star."
                    }
                    stars += this.ctx.img(params, rev.ratingStr);
                }
                for (let i = 0; i < blanks; i++) {
                    let params = {
                        url: this.ctx.cfg.reviewSpec.ratings.stars.none,
                        alt: "Rating star."
                    }
                    stars += this.ctx.img(params, rev.ratingStr);
                }

                rev.ratingStars = stars;
            }

            if (this.ctx.cfg.reviewSpec.ratings.alts && this.ctx.cfg.reviewSpec.ratings.alts[rev.rating]) {
                let rs = this.ctx.cfg.reviewSpec.ratings.alts[rev.rating];
                let cls = 'rating-string ' + str.slugify(rs);
                rev.ratingStr += ': <span class="' + cls + '">' + rs + '</span>';
            }

            if (rev.ratingStars && rev.ratingStars != '') {
                rev.ratingStr += '&nbsp;&nbsp;&nbsp;<span class="stars">' + rev.ratingStars + '</span>';
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
    
                    prod.key = prodKey;
   
                    // No review switch?
                    let noReview = false;
                    if (this.article.noReview) {
                        noReview = this.article.noReview;
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
    
                    // Brand.
                    if (prod.brand) {
                        if (prod.brand.url && prod.brand.name) {
                            prod.brandLink = this.ctx.link(prod.brand.name, prod.brand.url);
                        } else if (prod.brand.url) {
                            prod.brandLink = this.ctx.link(prod.brand.url, prod.brand.url);
                        } else if (prod.brand.name) {
                            prod.brandLink = prod.brand.name;
                        } else {
                            prod.brandLink = prod.brand;
                        }
                    }
    
                    // Category.
                    if (prod.category) {
                        prod.category = arr.makeArray(prod.category);
                        prod.categoryStr = prod.category.join(", ");
                    }
    
                    // Software specific.
                    if (prod.type == 'SoftwareApplication') {
                        // OS.
                        if (prod.os) {
                            prod.os = arr.makeArray(prod.os);
                            prod.osStr = prod.os.join(", ");
                        }
                        // Version.
                        if (prod.version) {
                            prod.version = arr.makeArray(prod.version);
                            prod.versionStr = prod.version.join(", ");
                        }
                    }
    
                    // Movie/TVSeries specific.
                    if (prod.type == 'Movie' || prod.type == 'TVSeries') {
    
                        // Actors & directors.
                        for (let arr of ['actors', 'directors']) {
                            if (prod[arr]) {
                                let fldName = arr + 'Str';
                                let result = ''; 
                                    for (let item of prod[arr]) {
                                    if (result != '') result += ', ';
                                    result += this.ctx.link(item.name, item.sameAs);
                                }
                                prod[fldName] = result;
                            }
                        }
    
                        // Duration.
                        if (prod.duration) {
                            prod.durationObj = new Duration(prod.duration);
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
                            prod.sameAsStr = str;
                        }
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
                        if (prod.offers.from || prod.offers.price || prod.offers.url) {
                            let o = this._processOffer(prod.offers, prod);
                            offersArr.push(o);
                        } else {
                            for (let offerKey in prod.offers) {
                                let o = this._processOffer(prod.offers[offerKey], prod, offerKey)
                                offersArr.push(o);
                            }
                        }
                        if (offersArr.length == 1) {
                            prod.offersStr = offersArr[0];
                        } else {
                            prod.offersStr = '<div class="offerblock">' + offersArr.join('<br />') + '</div>';
                        }
                    }
    
                    this.ctx.products[prodKey] = prod;

                }
            }
        }
    
    }
}

module.exports = ProductReviewProcessor;
