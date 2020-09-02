/**
 * @file        Product/review processing plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require('greenhat-util/syslog');
const ProductReviewProcessor = require("./productReviewProcessor");

/**
 * Called after article is parsed.
 */
async function afterArticleParserRun(article)
{
    syslog.trace('.productReviews:afterArticleParserRun', "Responding to hook.");

    if (!article.products && !article.reviews && !article.productRefs && !article.reviewRefs) {
        return;
    }

    let prp = new ProductReviewProcessor(article, this);
    await prp.process();
}

/**
 * Initialisation.
 */
module.exports = ctx => {

    syslog.trace('.productReviews', 'Initialising plugin.');

    let defaultReviewSpec = {
        ratings: {
            wantStars: true,
            stars: {
                full: '/assets/images/stars/starfull.png',
                half: '/assets/images/stars/starhalf.png',
                none: '/assets/images/stars/starnone.png',
            },
            alts: {
                0: "Dreadful",
                0.5: "Dismal",
                1: "Bad",
                1.5: "Poor",
                2: "Below Average",
                2.5: "Average",
                3: "Above Average",
                3.5: "Decent",
                4: "Good",
                4.5: "Great",
                5: "Excellent"
            }
        },
        currencies: {
            GBP: {
                symbol: '£',
                name: 'GBP',
            },
            USD: {
                symbol: '$',
                name: 'USD',
            },
            EUR: { 
                symbol: '€',
                name: 'EUR',
            }
        },
        defaultCurrency: 'GBP',
    };


    ctx.cfg.mergeSect('reviewSpec', defaultReviewSpec, true);

    ctx.products = {};
    ctx.reviews = {};

    // Set up event responses.
    ctx.on('AFTER_ARTICLE_PARSER_RUN', afterArticleParserRun);

}

