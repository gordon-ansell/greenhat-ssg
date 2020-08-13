/**
 * @file        Default config.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

module.exports = {
    // Directories.
    dirs: {
        site: '_site',
        config: '_config',
        layouts: '_layouts',
        sysLayouts: 'layouts',
        plugins: '_plugins',
        sysPlugins: 'src/plugins',
        cache: '_cache',
        temp: '_temp',
    },

   // Site spec.
    site: {
        title: "The title of your site.",
        lang: "en",
        dev: {
            addr: '127.0.0.1', 
            port: 8081
        },
        lazyload: true,
        lazyclass: 'lazyload',
        articlesPerPage: 20,
        postsInFeed: 30,
        homePagePostType: 'post',
        breadcrumbSpec: {
            format: [':home', ':tags0', ':tags1', ':title'],
            sep: ' &rarr; '
        },
        externalLinkIcon: '/assets/images/external-link.png',
        cache: false,
        cacheCssJsMax: "86400",
        cacheImagesMax: "2592000",
        webMentions: false,
    },

    // Template spec.
    templateSpec: {
        type: 'nunjucks',
        nunjucks: {
            ext: '.njk',
            opts: {autoescape: false, throwOnUndefined: true, lstripBlocks: true},
        }
    },

    // Filesystem parsing.
    fileSystemParser: {
        allowPaths: ['/_posts'],
        ignorePaths: ['/node_modules', '_', '.'],
        ignoreFiles: ['.', '_'],
        ignoreExts: ['sh', 'json', 'code-workspace'],
    },

    // Article spec.
    articleSpec: {
        articleExts: ['md', 'html'],
        taxonomies: ['tags'],
        outputMode: 'directory',
        terminateUrl: '/',
        indexFn: 'index.html',
        outputExt: '.html',
        posts: {
            postFnStart: "^\\d{4}-\\d{2}-\\d{2}-",
            postFnGrabLen: 10,
            postDirs: ['/_posts'],
            postCombineTest: 'or',
        },
        dispDate: "dS mmmm yyyy",
        dispTime: "HH:MM",
        multiFormat: ['content', 'contentRss', 'excerpt', 'summary'],
        types: {
            post: {
                permalink: ":fn",
            },
            page: {
                permalink: ":path/:fn",
            }
        },
    },

    // Article default spec.
    articleDefault: {
        sitemap: true,
        feed: true,
        published: true,
        late: false,
        robots: 'index, follow, NOODP',
        wantEffort: false,
    },

    // SCSS spec.
    scssSpec: {
        scssExt: 'scss',
        outputStyle: "compressed",
        autoPrefix: true,
    },
}