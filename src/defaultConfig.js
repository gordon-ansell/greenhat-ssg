/**
 * @file        Default config.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

module.exports = {

    // Site defaults.
    site: {
        name: "Your site title.",
        description: "Your site description",
        lang: "en_GB",
        lazyload: false,
        lazyclass: 'lazyload',
        cache: false,
        cacheCssJsMax: "86400",
        cacheImagesMax: "2592000",
        errorControl: {
            exitOnFirst: true,
            printStack: false,
            showAllErrors: false,
        }
    },

    // Various locations.
    locations: {
        layouts: "_layouts",
        sysLayouts: "layouts",
        site: "_site",
        temp: "_temp",
        cache: "_cache",
        config: "_config",
        data: "_data",
        plugins: "_plugins",
        sysPlugins: "src/plugins",
        posts: ["_posts"]
    },

    // Filesystem parsing.
    fileSystemParser: {
        allowPaths: ['/_posts'],
        ignorePaths: ['/node_modules', '_', '.'],
        ignoreFiles: ['.', '_'],
        ignoreExts: ['sh', 'json', 'code-workspace'],
    },

    // Image spec.
    imageSpec: {
        imageExts: ['gif', 'ico', 'jpg', 'jpeg', 'png', 'svg', 'webp'],
    },

    // Template spec.
    templateSpec: {
        defaultType: 'njk',
        njk: {
            opts: {autoescape: false, throwOnUndefined: true, lstripBlocks: true},
        }
    },

    // Taxonomy spec.
    taxonomySpec: {
        keywords: {
            nameStr: ['Tag', 'Tags'],
            taxonomyTypeName: 'tags',
            path: '/tags',
        },
        articleSection: {
            nameStr: ['Section', 'Sections'],
            taxonomyTypeName: 'sections',
            path: '/sections',
        },
        _articleTypes: {
            nameStr: ['Type', 'Types'],
            taxonomyTypeName: 'types',
            path: '/types',
        }
    },

    // Parsers.
    parsers: {
    },
    earlyParse: [],

    // Renderers.
    renderers: {
    },

    // Language strings.
    langStrs: {
        en: {
            and: 'and',
            by: 'by',
            home: 'home',
            link: 'link',
            map: 'map',
            on: 'on',
        }
    },

    // Config checks.
    cfgChk: {
        site: {
            _compulsory: ['prodDomain'],
            _advisory: ['name', 'description', 'publisher', 'authors'],

            publisher: {
                _compulsory: ['name', 'url'],
            },

            authors: {
                _each: {
                    _compulsory: ['name', 'url'],
                }
            }
        }
    },
}