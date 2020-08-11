/**
 * @file        Related posts plugin.
 * @module      plugins/relatedPosts
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog, merge, makeArray } = require('greenhat-base');

/**
 * Called after config processing.
 */
function AfterConfig()
{
    syslog.trace('plugin:relatedPosts:afterConfig', "Responding to hook.");

    let defaultRelatedPostsSpec = {
        defaultMatchesMin: 2,
        excludeTaxonomies: [],
        maxRelatedPosts: 4,
    };
    
    if (this.ctx.config.relatedPostsSpec) {
        this.ctx.config.relatedPostsSpec = merge(defaultRelatedPostsSpec, this.ctx.config.relatedPostsSpec);
    } else {
        this.ctx.config.relatedPostsSpec = defaultRelatedPostsSpec;
    }
}

/**
 * Called after article sort processing.
 */
function AfterArticleSort()
{
    syslog.trace('plugin:relatedPosts:afterArticleSort', "Responding to hook.");

    if (!this.ctx.articles.post) {
        return;
    }

    let spec = this.ctx.config.relatedPostsSpec;

    // Set up the list to start with.
    let filteredExclusions = {};
    for (let articleKey of this.ctx.articles.post.keys()) {
        let article = this.ctx.articles.post.get(articleKey);
        let newTags = [];
        if (article.tags) {
            let tags = makeArray(article.tags);
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
            if (a.count > b.count) return -1;
            if (b.count > a.count) return 1;
            return 0;
        })
    }

    // Now add the related posts to each article.
    for (let srcKey in sorted) {
        this.ctx.articles.post.get(srcKey).relatedPosts = [];
        let count = 0;
        for (let item of sorted[srcKey]) {
            let target = this.ctx.articles.post.get(item.target);
            this.ctx.articles.post.get(srcKey).relatedPosts.push({
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

exports.AfterConfig = AfterConfig;
exports.AfterArticleSort = AfterArticleSort;