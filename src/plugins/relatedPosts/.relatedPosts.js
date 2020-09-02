/**
 * @file        Related posts plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require('greenhat-util/syslog');
require("greenhat-util/array");

/**
 * Called after all articles parsed.
 */
async function afterParseLate()
{
    syslog.trace('.relatedPosts:afterParseLate', "Responding to hook.");

    if (!this.articles.type.post) {
        return;
    }

    let spec = this.cfg.relatedPostsSpec;

    // Set up the list to start with.
    let filteredExclusions = {};
    for (let articleKey of this.articles.type.post.keys()) {
        let article = this.articles.type.post.get(articleKey);
        let newTags = [];
        if (article.tags) {
            let tags = Array.makeArray(article.tags);
            for (let tag of tags) {
                if (!spec.excludeTaxonomies.includes(tag)) {
                    newTags.push(tag);
                }
            }
        }
        if (newTags && newTags.length > 0) {
            filteredExclusions[articleKey] = newTags;
        }
    }

    //syslog.inspect(filteredExclusions);

    // See how many matches each post has with another post.
    let matches = {};
    for (let srcKey in filteredExclusions) {
        matches[srcKey] = [];
        let srcTags = filteredExclusions[srcKey]; 
        for (let tarKey in filteredExclusions) {
            if (tarKey == srcKey) {
                continue;
            }
            let intersection = srcTags.filter(x => filteredExclusions[tarKey].includes(x));
            if (intersection.length > 0 && intersection.length >= spec.defaultMatchesMin) {
                matches[srcKey].push({target: tarKey, count: intersection.length, tags: intersection});
            }
        }
        if (matches[srcKey].length == 0) {
            delete matches[srcKey];
        }
    }


    // Sort the matches.
    let sorted = {};
    for (let srcKey in matches) {
        sorted[srcKey] = matches[srcKey].sort((a, b) => {

            if (a.count == b.count) {
                if (this.articles.type.post.get(a.target).dates.published.ms > 
                    this.articles.type.post.get(b.target).dates.published.ms) {
                    return -1;
                } else {
                    return 1;
                }
            }

            if (a.count > b.count) return -1;
            if (b.count > a.count) return 1;
            return 0;
        })
    }

    // Now add the related posts to each article.
    for (let srcKey in sorted) {
        this.articles.type.post.get(srcKey).relatedPosts = [];
        let count = 0;
        for (let item of sorted[srcKey]) {
            let target = this.articles.type.post.get(item.target);
            this.articles.type.post.get(srcKey).relatedPosts.push({
                title: target.title,
                url: target.url,
                description: target.description,
            });
            count++;
            if (count >= spec.maxRelatedPosts) {
                break;
            }
        }
    }
}

/**
 * Initialisation.
 */
module.exports = ctx => {

    syslog.trace('.relatedPosts', 'Initialising plugin.');

    // Load some configs.
    let defaultRelatedPostsSpec = {
        defaultMatchesMin: 2,
        excludeTaxonomies: [],
        maxRelatedPosts: 4,
    };

    ctx.cfg.mergeSect('relatedPostsSpec', defaultRelatedPostsSpec, true);

    // Set up event responses.
    ctx.on('AFTER_PARSE_LATE', afterParseLate);

}

