/**
 * @file        Article schema object.
 * @module      article/ArticleSchema
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog, makeArray, merge, Duration } = require("greenhat-base");
const path = require('path');

/**
 * Article schema class.
 */
class ArticleSchema
{
    static context = 'https://schema.org';

    /**
     * Constructor.
     * 
     * @param   {object}    ctx         Context.
     * @param   {object}    article     Article object.
     */
    constructor(ctx, article)
    {
        this.ctx = ctx;
        this.cfg = ctx.config;
        this.article = article;
        this.schema = [];
    }

    /**
     * Create an ID.
     * 
     * @param   {string}    name    Name.
     * @return  {string}            ID string.
     */
    _id(name)
    {
        return path.sep + '#' + name.slugify();
    }

    /**
     * Get an ID reference.
     * 
     * @param   {string}    name    Name.
     * @return  {string}            ID refernce string.
     */
    _idref(name)
    {
        return {
            '@id': path.sep + '#' + name.slugify()
        };
    }

    /**
     * Get an image.
     * 
     * @param   {string}    url     Image (relative) URL.
     * @return  {string|string[]}   Real URLs for the image.
     */
    _getImageUrls(url)
    {
        if (this.ctx.images && this.ctx.images.has(url)) {
            return this.ctx.images.get(url).allUrls();
        }
        return url;
    }

    /**
     * Process HowTos.
     */
    _processHowTos()
    {
        if (!this.article.howTo) {
            return;
        }

        if (!this.article.howTo.name) {
            this.article.howTo.name = this.article.title;
        }

        if (!this.article.howTo.description) {
            this.article.howTo.description = this.article.description;
        }

        if (!this.article.howTo.supply) {
            this.article.howTo.supply = 'n/a';
        }

        if (!this.article.howTo.tool) {
            this.article.howTo.tool = 'n/a';
        }  

        let duration = new Duration(this.article.howTo.time);
        
        let result = {
            '@context': ArticleSchema.context,
            '@type': 'HowTo',
            'name': this.article.howTo.name,
            'description': this.article.howTo.description,
            'totalTime': duration.pt,
            'supply': this.article.howTo.supply,
            'tool': this.article.howTo.tool,
            'isPartOf': this._idref('webpage'),
        }

        let theSteps = [];

        for (let st of this.article.howTo.steps) {
            let str = {
                '@type': 'HowToStep',
                'name': st.name,
                'text': st.text,
                'url': path.join(this.article.url, '#' + st.url),
                'image': this.article.getImageUrlsForTags(st.image),
            }

            theSteps.push(str);
        }

        result['step'] = theSteps;

        this.schema.push(result);
    }

    /**
     * Process reviews.
     */
    _processReviews()
    {
        if (!this.article.reviews && !this.article.reviewRefs) {
            return;
        }

        for (let arr of ['reviews', 'reviewRefs']) {

            if (!this.article[arr]) {
                continue;
            }

            for (let key in this.article[arr]) {

                let rev = this.article[arr][key];

                //syslog.inspect(this.ctx.products);
                let prod = this.ctx.products[key];

                let result = {
                    '@type': 'Review',
                    '@id': this._id('review-' + key),
                    '@context': ArticleSchema.context,
                    'name': prod.name,
                    'description': rev.description,
                    'reviewRating': {
                        '@type': 'Rating',
                        'ratingValue': rev.rating,
                        'bestRating': rev.bestRating,
                        'worstRating': rev.worstRating,
                    },
                    'mainEntityOfPage': this._idref('article'),
                    'isPartOf': this._idref('article'),
                    'publisher': this._idref('publisher'),
                }

                if (this.article.author) {
                    //syslog.inspect(this.article.author);
                    let auths = [];
                    for (let key in this.article.author) {
                        auths.push(this._idref('author-' + key));
                    }
                    result['author'] = auths;
                }

                this.schema.push(result);
            }
        }
    }

    /**
     * Process products.
     */
    _processProducts()
    {
        if (!this.article.products && !this.article.productRefs) {
            return;
        }

        for (let arr of ['products', 'productRefs']) {

            if (!this.article[arr]) {
                continue;
            }

            for (let key in this.article[arr]) {

                let prod = this.article[arr][key];

                let result = {
                    '@type': prod.type,
                    '@id': this._id('product-' + key),
                    '@context': ArticleSchema.context,
                    'name': prod.name,
                }

                // Brand.
                if (prod.brand) {

                    let kn = 'brand';
                    switch (prod.type) {
                        case 'SoftwareApplication':
                            kn = 'creator';
                            break;
                        case 'TVSeries':
                        case 'Movie':
                            kn = 'productionCompany';
                            break;
                    }

                    result[kn] = {
                        '@type': 'Organization',
                        'name': prod.brand.name,
                    }

                    if (prod.brand.url) {
                        result[kn].url = prod.brand.url;
                    }
                }

                // Category.
                if (prod.category) {

                    let kn = 'category';
                    switch (prod.type) {
                        case 'SoftwareApplication':
                            kn = 'applicationCategory';
                            break;
                        case 'TVSeries':
                        case 'Movie':
                            kn = 'genre';
                            break;
                    }

                    result[kn] = prod.category;
                }

                // URL.
                if (prod.url) {
                    result['url'] = prod.url;
                }

                // Description.
                if (prod.description) {
                    result['description'] = prod.description;
                }

                // Version.
                if (prod.version) {
                    result['version'] = prod.version;
                }

                // OS.
                if (prod.os) {
                    result['operatingSystem'] = prod.os;
                }

                // Actors, directors.
                let darr = ['actors', 'directors'];
                for (let arr of darr) {

                    if (prod[arr]) {

                        let r = [];

                        for (let person of prod[arr]) {

                            let n = {
                                '@type': 'Person',
                                'name': person.name,
                            }

                            if (person.sameAs) {
                                n['sameAs'] = person.sameAs;
                            }

                            r.push(n);
                        }

                        result[arr] = r;
                    }
                }

                // Date.
                if (prod.date) {
                    result['dateCreated'] = prod.date;
                }

                // Start date.
                if (prod.startDate) {
                    result['startDate'] = prod.startDate;
                }

                // End date.
                if (prod.endDate) {
                    result['endDate'] = prod.endDate;
                }

                // Status.
                if (prod.eventStatus) {
                    result['eventStatus'] = prod.eventStatus;
                }

                // Attendance mode.
                if (prod.eventAttendanceMode) {
                    result['eventAttendanceMode'] = prod.eventAttendanceMode;
                }

                // Duration.
                if (prod.duration) {
                    result['duration'] = prod.durationObj.pt;
                }

                // SameAs?
                if (prod.sameAs) {
                    result['sameAs'] = prod.sameAs;
                }

                // Location.
                if (prod.location) {
                    result['location'] = {
                        '@type': 'Place',
                        'address': prod.location,
                        'name': prod.name,
                    }

                }

                // Performer.
                if (prod.performer) {
                    result['performer'] = {
                        '@type': 'Person',
                        'name': prod.performer,
                    }
                }

                // Organizer.
                if (prod.organizer) {
                    result['organizer'] = {
                        '@type': 'Organization',
                        'name': prod.organizer,
                    }
                } else if (prod.type == 'Event') {
                    result['organizer'] = {
                        '@type': 'Organization',
                        'name': prod.name,
                        'url': prod.url,
                    }
                }
                
                // Artist.
                if (prod.artist) {
                    let t = 'Person'
                    if (prod.isGroup) {
                        t = 'MusicGroup';
                    }
                    result['byArtist'] = {
                        '@type': t,
                        'name': prod.artist
                    }
                }

                // Address.
                if (prod.address) {
                    result['address'] = prod.address;
                }

                // Email.
                if (prod.email) {
                    result['email'] = prod.email;
                }

                // Telephone.
                if (prod.telephone) {
                    result['telephone'] = prod.telephone;
                }

                // Price range.
                if (prod.priceRange) {
                    result['priceRange'] = prod.priceRange;
                }

                // Opening hours.
                if (prod.openingHours) {
                    result['openingHours'] = prod.openingHours;
                }

                // Images.
                if (prod.images) {
                    let imgs = [];
                    for (let ikey of prod.images) {
                        imgs = merge(imgs, this.articleImagesByTag[ikey]);
                    }
                    result['image'] = imgs;
                } else {
                    result['image'] = this.articleImages;
                }

                // Videos.
                if (prod.type != 'Product') {
                    if (prod.videos) {
                        let vids = [];
                        for (let key of prod.videos) {
                            imgs.push(this._idref('avid-' + key));
                        }
                        result['video'] = vids;
                    } else {
                        result['video'] = this.articleVideos;
                    }
                }

                // Review?
                if (this.ctx.reviews[key]) {
                    let rev = this.ctx.reviews[key];

                    result['aggregateRating'] = {
                        '@type': 'AggregateRating',
                        'ratingValue': rev.rating,
                        'bestRating': rev.bestRating,
                        'worstRating': rev.worstRating,
                        'reviewCount': rev.reviewCount,
                    }

                    result['review'] = this._idref('review-' + key);

                }

                // Product numbers.
                let ids = ['mpn', 'sku'];
                for (let item of ids) {
                    if (prod[item]) {
                        result[item] = prod[item];
                    }
                }
                            
                // Offers.
                if (prod.offers) {
                    let offers = [];

                    if (prod.offers.from || prod.offers.price || prod.offers.url) {
                        let off = {
                            '@type': 'Offer',
                            'price': prod.offers.price,
                            'url': prod.offers.url,
                            'availability': prod.offers.availability,
                            'offeredBy': {
                                '@type': 'Organization',
                                'name': prod.offers.from
                            }
                        }

                        if (prod.offers.priceCurrency) {
                            off['priceCurrency'] = prod.offers.priceCurrency.name;
                        }

                            
                        if (prod.offers.priceValidUntil) {
                            off['priceValidUntil'] = prod.offers.priceValidUntil;
                        }

                        if (prod.offers.validFrom) {
                            off['validFrom'] = prod.offers.validFrom;
                        }

                        let ids = ['mpn', 'sku'];
                        for (let item of ids) {
                            if (prod.offers[item]) {
                                off[item] = prod.offers[item];
                            }
                        }

                        offers.push(off);

                    } else {
                        for (let k in prod.offers) {
                            let item = prod.offers[k];
                            let off = {
                                '@type': 'Offer',
                                'price': item.price,
                                'url': item.url,
                                'availability': item.availability,
                                'offeredBy': {
                                    '@type': 'Organization',
                                    'name': item.from
                                }
                            }

                            if (item.priceCurrency) {
                                off['priceCurrency'] = item.priceCurrency.name;
                            }
                            
                            if (item.priceValidUntil) {
                                off['priceValidUntil'] = item.priceValidUntil;
                            }

                            if (item.validFrom) {
                                off['validFrom'] = item.validFrom;
                            }

                            let ids = ['mpn', 'sku'];
                            for (let i of ids) {
                                if (item[i]) {
                                    off[i] = item[i];
                                }
                            }

                            offers.push(off);
    
                        }
                    }

                    result['offers'] = offers;
                }


                // Save it.
                this.schema.push(result);

            }
        }
    }

    /**
     * Process the article videos.
     */
    _processArticleVideos()
    {
        this.articleVideos = [];

        if (!this.article.videos && !this.article.videoRefs) {
            return;
        }

        for (let arr of ['videos']) {

            if (!this.article[arr]) {
                continue;
            }

            for (let key in this.article[arr]) {

                let vidObj = this.article.videoObjs[key];

                let result = {
                    '@type': 'VideoObject',
                    '@id': this._id('avid-' + key),
                    '@context': ArticleSchema.context,
                    'name': vidObj.title,
                    'contentUrl': vidObj.contentUrl,
                    'embedUrl': vidObj.embedUrl,
                    'thumbnailUrl': vidObj.thumbnailUrl,
                    'uploadDate': vidObj.uploadDate,
                }

                if (vidObj.caption) {
                    result['caption'] = vidObj.caption;
                }

                if (vidObj.description) {
                    result['description'] = vidObj.description;
                }

                this.schema.push(result);
                this.articleVideos.push(this._idref('avid-' + key));

            }
        }
    }

    /**
     * Process the article images.
     */
    _processArticleImages()
    {
        this.articleImages = [];
        this.articleImagesByTag = {};

        if (!this.article.images && !this.article.imageRefs) {
            if (this.ctx.config.site.defaultArticleImage) {
                this.articleImages.push(this.ctx.config.site.defaultArticleImage);
            }
            return;
        }

        let spec = this.ctx.config.imageSpec;

        for (let arr of ['images', 'imageRefs']) {

            if (!this.article[arr]) {
                continue;
            }

            for (let key in this.article[arr]) {

                let obj = this.article[arr][key];

                let imgObj = this.ctx.images.get(obj.url);

                if (!imgObj.hasSubimages()) {

                    let result = {
                        '@type': 'ImageObject',
                        '@id': this._id('aimg-' + key),
                        '@context': ArticleSchema.context,
                        'url': imgObj.relPath,
                        'contentUrl': imgObj.relPath,
                        'width': imgObj.width,
                        'height': imgObj.height,
                        'representativeOfPage': true,
                    }

                    if (spec.licencePage) {
                        result['acquireLicensePage'] = spec.licencePage;
                    }

                    if (obj.caption) {
                        result['caption'] = obj.caption;
                    }

                    this.schema.push(result);
                    this.articleImages.push(this._idref('aimg-' + key));

                    if (!this.articleImagesByTag[key]) {
                        this.articleImagesByTag[key] = [];
                    }

                    this.articleImagesByTag[key].push(this._idref('aimg-' + key));

                } else {

                    let keystart = 'aimg-' + key.slugify() + '-';

                    for (let subKey of imgObj.subs.keys()) {

                        let subObj = imgObj.subs.get(subKey);

                        let result = {
                            '@type': 'ImageObject',
                            '@id': this._id(keystart + subKey),
                            '@context': ArticleSchema.context,
                            'url': subObj.relPath,
                            'contentUrl': subObj.relPath,
                            'width': subObj.width,
                            'height': subObj.height,
                            'representativeOfPage': true,
                            'thumbnail': { 
                                '@type': 'ImageObject',
                                'url': imgObj.smallest.relPath 
                            },
                        }    

                        if (spec.licencePage) {
                            result['acquireLicensePage'] = spec.licencePage;
                        }

                        if (obj.caption) {
                            result['caption'] = obj.caption;
                        }

                        this.schema.push(result);
                        this.articleImages.push(this._idref(keystart + subKey));    

                        if (!this.articleImagesByTag[key]) {
                            this.articleImagesByTag[key] = [];
                        }
    
                        this.articleImagesByTag[key].push(this._idref(keystart + subKey));
                    }

                }
            }
        }
    }

    /**
     * Process the article.
     */
    _processArticle()
    {
        this._processArticleImages();
        this._processArticleVideos();

        let type = 'Article';
        if (this.article.type == 'post') {
            let type = 'BlogPosting';
        }

        let result = {
            '@type': type,
            '@id': this._id('article'),
            '@context': ArticleSchema.context,
            'name': this.article.title,
            'headline': this.article.headline,
            'url': this.article.url,
            'datePublished': this.article.dates.published.iso,
            'dateModified': this.article.dates.modified.iso,
            'mainEntityOfPage': this._idref('webpage'),
            'publisher': this._idref('publisher'),
        }

        if (this.article.description) {
            result['description'] = this.article.description;
        }

        if (this.article.author) {
            //syslog.inspect(this.article.author);
            let auths = [];
            for (let key in this.article.author) {
                auths.push(this._idref('author-' + key));
            }
            result['author'] = auths;
        }

        if (this.articleImages) {
            result['image'] = this.articleImages;
        }

        if (this.articleVideos) {
            result['video'] = this.articleVideos;
        }

        this.schema.push(result);
    }

    /**
     * Process the webpage.
     */
    _processWebpage()
    {
        let result = {
            '@type': 'WebPage',
            '@id': this._id('webpage'),
            '@context': ArticleSchema.context,
            'name': this.article.title,
            'url': this.article.url,
            'isPartOf': this._idref('website'),
            'breadcrumb': this._idref('breadcrumb'),
        }

        if (this.article.description) {
            result['description'] = this.article.description;
        }

        this.schema.push(result);
    }

    /**
     * Process the breadcrumbs.
     */
    _processBreadcrumbs()
    {
        let result = {
            '@type': 'BreadcrumbList',
            '@id': this._id('breadcrumb'),
            '@context': ArticleSchema.context,
            'name': this.article.title,
            'itemListElement': [],
        }

        let spec = this.ctx.config.site.breadcrumbSpec;
        let taxonomies = this.ctx.config.articleSpec.taxonomies;

        let bc = spec.format;
        if (this.article.breadcrumbSpec) {
            bc = this.article.breadcrumbSpec;
        }

        let pos = 1;

        for (let part of bc) {
            switch (part) {
                case ':home':
                    result.itemListElement.push({
                        '@type': 'ListItem',
                        'item': {
                            '@id': '/',
                            '@type': 'WebPage',
                            'name': 'Home',
                        },
                        'position': pos
                    });
                    pos++;
                    break;
                case 'tags':
                    result.itemListElement.push({
                        '@type': 'ListItem',
                        'item': {
                            '@id': '/tags/',
                            '@type': 'WebPage',
                            'name': 'Tags',
                        },
                        'position': pos
                    });
                    pos++;
                    break;
                case ':tags0':
                    if (this.article.tags && this.article.tags.length > 0) {
                        result.itemListElement.push({
                            '@type': 'ListItem',
                            'item': {
                                '@id': '/tags/' + this.article['tags'][0].slugify() + '/',
                                '@type': 'WebPage',
                                'name': this.article['tags'][0],
                            },
                            'position': pos
                        });
                        pos++;
                    }
                    break;
                case ':tags1':
                    if (this.article.tags && this.article.tags.length > 1) {
                        result.itemListElement.push({
                            '@type': 'ListItem',
                            'item': {
                                '@id': '/tags/' + this.article['tags'][1].slugify() + '/',
                                '@type': 'WebPage',
                                'name': this.article['tags'][1],
                            },
                            'position': pos
                        });
                        pos++;
                    }
                    break;
                case ':title':
                    result.itemListElement.push({
                        '@type': 'ListItem',
                        'item': {
                            '@id': this.article.url,
                            '@type': 'WebPage',
                            'name': this.article.title,
                        },
                        'position': pos
                    });
                    pos++;
                    break;
            }
        }

        this.schema.push(result);
    }

    /**
     * Process the website.
     */
    _processWebsite()
    {
        let result = {
            '@type': 'WebSite',
            '@id': this._id('website'),
            '@context': ArticleSchema.context,
            'name': this.ctx.config.site.title,
            'url': '/',
        }

        if (this.ctx.config.site.description) {
            result['description'] = this.ctx.config.site.description;
        }

        if (this.ctx.config.site.publisher.logo) {
            result['image'] = this.ctx.config.site.publisher.logo;
        }

        if (this.ctx.config.site.keywords) {
            result['keywords'] = this.ctx.config.site.keywords;
        }

        this.schema.push(result);
    }

    /**
     * Process the authors.
     */
    _processAuthors()
    {
        if (!this.cfg.site.authors) {
            return;
        }

        let spec = this.cfg.site.authors;

        for (let authorKey in spec) {
            let authorObj = spec[authorKey];

            let result = {
                '@type': 'Person',
                '@id': this._id('author-' + authorKey.slugify()),
                '@context': ArticleSchema.context,
            }

            for (let key of ['name', 'url']) {
                if (authorObj[key]) {
                    result[key] = authorObj[key]
                }
            } 

            if (authorObj['image']) {
                result['image'] = this._getImageUrls(authorObj['image']);
            }

            this.schema.push(result);
            
        }
    }

    /**
     * Process the publisher.
     */
    _processPublisher()
    {
        if (!this.cfg.site.publisher) {
            return;
        }

        let spec = this.cfg.site.publisher;

        let result = {
            '@type': (spec.type && spec.type == 'person') ? 'Person' : 'Organization',
            '@id': this._id('publisher'),
            '@context': ArticleSchema.context,
        }

        for (let key of ['name', 'url']) {
            if (spec[key]) {
                result[key] = spec[key];
            }
        }

        if (spec.logo) {
            if (spec.type && spec.type == 'person') {
                result['image'] = this._getImageUrls(spec['logo']);
            } else {
                result['logo'] = {
                    '@type': 'ImageObject',
                    'url': this._getImageUrls(spec['logo'])
                }
            }
        }

        this.schema.push(result);
    }

    /**
     * Parse the schema.
     */
    parse()
    {
        this._processPublisher();
        this._processAuthors();
        this._processWebsite();
        this._processBreadcrumbs();
        this._processWebpage();
        this._processArticle();
        this._processProducts();
        this._processReviews();
        this._processHowTos();
    }
}

module.exports = ArticleSchema
