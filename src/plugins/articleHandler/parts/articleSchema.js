/**
 * @file        Article schema object.
 * @module      ArticleSchema
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require("greenhat-util/syslog");
const path = require('path');
const Duration = require("greenhat-util/duration");
const { Schema, SchemaCollection, CreativeWork, SchemaBase } = require("greenhat-schema");
const str = require("greenhat-util/string");
const { merge } = require("greenhat-util/merge");

/**
 * Article schema class.
 */
class ArticleSchema
{
    static context = 'https://schema.org';

    coll = null;

    /**
     * Constructor.
     * 
     * @param   {object}    ctx         Context.
     * @param   {object}    article     Article object.
     */
    constructor(ctx, article)
    {
        this.ctx = ctx;
        this.cfg = ctx.cfg;
        this.article = article;

        this.coll = new SchemaCollection();
    }

    /**
     * Get an image.
     * 
     * @param   {string}    url     Image (relative) URL.
     * @return  {string|string[]}   Real URLs for the image.
     */
    _getImageUrls(url)
    {
        if (this.ctx.hasCallable('getImageUrls')) {
            if (this.ctx.callable('hasImage', url)) {
                return this.ctx.callable('getImageUrls', url);
            }
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
            this.article.howTo.name = this.article.name;
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

        let schema = Schema.howTo()
            .name(this.article.howTo.name)
            .description(this.article.howTo.description)
            .supply(this.article.howTo.supply)
            .tool(this.article.howTo.tool)
            .totalTime(duration.pt)
            .isPartOf(Schema.ref(path.sep + '#webpage'));
        
        let theSteps = [];

        for (let st of this.article.howTo.steps) {

            let step = Schema.howToStep()
                .name(st.name)
                .text(st.text)
                .url(path.join(this.article.url, '#' + st.url))
                .image(this.article.getImageUrlsForTags(st.image));

            theSteps.push(step);
        }

        schema.step(theSteps);

        this.coll.add('howto', schema);
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

                let prod = this.ctx.products[key];

                let id = 'review-' + key;
                //let fullId = path.sep + '#' + id;

                let schema = Schema.review(id)
                    .description(rev.description)
                    .name(prod.name)
                    .mainEntityOfPage(Schema.ref(path.sep + '#' + 'article'))
                    .isPartOf(Schema.ref(path.sep + '#' + 'article'))
                    .publisher(Schema.ref(path.sep + '#' + 'publisher'))
                    .reviewRating(Schema.rating()
                        .ratingValue(rev.rating)
                        .bestRating(rev.bestRating || 5)
                        .worstRating(rev.worstRating || 0)
                    );

                if (this.article.author) {
                    let auths = [];
                    for (let key of this.article.author) {
                        auths.push(Schema.ref('author-' + str.slugify(key)));
                    }
                    schema.author(auths);
                }

                this.coll.add(id, schema);
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

                let id = 'product-' + key;
                //let fullId = path.sep + '#' + id;

                let t = prod.type;
                if (t.startsWith('TV')) {
                    t = 'tv' + t.substring(2);
                } else {
                    t = str.lcfirst(t);
                }

                let schema = Schema[t](id).name(prod.name);

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

                    let org = Schema.organization().name(prod.brand.name);

                    if (prod.brand.url) {
                        org.url(prod.brand.url);
                    }

                    schema.setProp(kn, org);

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

                    //result[kn] = prod.category;
                    schema.setProp(kn, prod.category);
                }

                // Simples
                let simples = ['url', 'description', 'version', 'startDate', 'endDate',
                    'eventStatus', 'eventAttendanceMode', 'sameAs', 'address', 'email', 'telephone',
                    'priceRange', 'openingHours']

                for (let simp of simples) {
                    if (prod[simp]) {
                        if (!(typeof schema[simp] == "function")) {
                            syslog.warning(`No function '${simp}' in ${schema.constructor.name}.`);
                        }
                        schema[simp](prod[simp]);
                    }
                }

                if (prod.date) {
                    schema.dateCreated(prod.date);
                }

                // OS.
                if (prod.os) {
                    schema.operatingSystem(prod.os);
                }

                // Actors, directors.
                let darr = ['actors', 'directors'];
                for (let arr of darr) {

                    if (prod[arr]) {

                        let r = [];

                        for (let person of prod[arr]) {

                            let p = Schema.person().name(person.name);

                            if (person.sameAs) {
                                p.sameAs(person.sameAs);
                            }

                            r.push(p);
                        }

                        schema.setProp(arr.slice(0, -1), r)
                    }
                }


                // Duration.
                if (prod.duration) {
                    schema.duration(prod.durationObj.pt);
                }


                // Location.
                if (prod.location) {
                    schema.location(Schema.place().address(prod.location).name(prod.name));

                }

                // Performer.
                if (prod.performer) {
                    schema.performer(Schema.person().name(prod.performer));
                }

                // Organizer.
                if (prod.organizer) {
                    schema.organizer(Schema.organization().name(prod.organizer));
                } else if (prod.type == 'Event') {
                    schema.organizer(Schema.organization().name(prod.name).url(prod.url));
                }
                
                // Artist.
                if (prod.artist) {
                    let tn = Schema.person();
                    if (prod.isGroup) {
                        tn = Schema.musicGroup();
                    }

                    schema.byArtist(tn.name(prod.artist));
                }


                // Images.
                if (prod.images) {
                    let imgs = [];
                    for (let ikey of prod.images) {
                        //imgs = Object.merge(imgs, this.articleImagesByTag[ikey]);
                        imgs = merge(imgs, this.articleImagesByTag[ikey]);
                    }
                    schema.image(imgs);
                } else {
                    schema.image(this.articleImages);
                }

                // Videos.
                if (schema instanceof CreativeWork) {
                    if (prod.videos) {
                        let vids = [];
                        for (let key of prod.videos) {
                            imgs.push(Schema.ref('avid-' + key));
                        }
                        schema.video(vids);
                    } else {
                        schema.video(this.articleVideos);
                    }
                }

                // Review?
                if (this.ctx.reviews[key]) {
                    let rev = this.ctx.reviews[key];

                    if (!(typeof schema['aggregateRating'] == "function")) {
                        syslog.warning(`No function 'aggregateRating' in ${schema.constructor.name}.`);
                    }

                    schema.aggregateRating(
                        Schema.aggregateRating()
                            .ratingValue(rev.rating)
                            .bestRating(rev.bestRating)
                            .worstRating(rev.worstRating)
                            .reviewCount(rev.reviewCount)
                    );

                    schema.review(Schema.ref('review-' + key));
                }

                // Product numbers.
                if (prod.type == 'Product') {
                    let ids = ['mpn', 'sku'];
                    for (let item of ids) {
                        if (prod[item]) {
                            schema.setProp(item, prod[item]);
                        }
                    }
                }
                            
                // Offers.
                if (prod.offers) {
                    let offers = [];

                    if (prod.offers.from || prod.offers.price || prod.offers.url) {

                        let off = Schema.offer()
                            .price(prod.offers.price)
                            .url(prod.offers.url)
                            .availability(prod.offers.availability)
                            .offeredBy(Schema.organization().name(prod.offers.from))

                        for (let bit of ['priceCurrency', 'priceValidUntil', 'validFrom', 'mpn', 'sku']) {
                            if (prod.offers[bit]) {
                                if (bit = 'priceCurrency') {
                                    off.setProp(bit, prod.offers[bit].name);
                                } else {
                                    off.setProp(bit, prod.offers[bit]);
                                }
                            }
                        }

                        if (!off.hasProp('priceValidUntil')) {
                            let oneYear = new Date();
                            oneYear.setFullYear(oneYear.getFullYear() + 1);
                            off.setProp('priceValidUntil', oneYear.toISOString());
                        }

                        offers.push(off);

                    } else {
                        for (let k in prod.offers) {
                            let item = prod.offers[k];
                            let off = Schema.offer()
                                .price(item.price)
                                .url(item.url)
                                .availability(item.availability)
                                .offeredBy(Schema.organization().name(item.from))

                            for (let bit of ['priceCurrency', 'priceValidUntil', 'validFrom', 'mpn', 'sku']) {
                                if (item[bit]) {
                                    if (bit = 'priceCurrency') {
                                        off.setProp(bit, item[bit].name);
                                    } else {
                                        off.setProp(bit, item[bit]);
                                    }
                                }
                            }

                            if (!off.hasProp('priceValidUntil')) {
                                let oneYear = new Date();
                                oneYear.setFullYear(oneYear.getFullYear() + 1);
                                off.setProp('priceValidUntil', oneYear.toISOString());
                            }
                                
                            offers.push(off);
    
                        }
                    }

                    schema.offers(offers);
                }

                // Save it.
                this.coll.add(id, schema);

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

                let id = 'avid-' + key;
                //let fullId = path.sep + '#' + id;

                let vidObj = this.article.videoObjs[key];

                let schema = Schema.videoObject(id)
                    .name(vidObj.title)
                    .contentUrl(vidObj.contentUrl)
                    .embedUrl(vidObj.embedUrl)
                    .thumbnailUrl(vidObj.thumbnailUrl)
                    .uploadDate(vidObj.uploadDate);

                if (vidObj.caption) {
                    schema.caption(vidObj.caption);
                }

                if (vidObj.description) {
                    schema.description(vidObj.description);
                }

                this.coll.add(id, schema);
                this.articleVideos.push(Schema.ref(id));

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

        if (!this.ctx.hasCallable('getImage')) {
            return;
        }

        if (!this.article.images && !this.article.imageRefs) {
            if (this.ctx.cfg.site.defaultArticleImage) {
                this.articleImages.push(this.ctx.cfg.site.defaultArticleImage);
            }
            return;
        }

        let spec = this.ctx.cfg.imageSpec;

        for (let arr of ['images', 'imageRefs']) {

            if (!this.article[arr]) {
                continue;
            }

            for (let key in this.article[arr]) {

                let obj = this.article[arr][key];

                let imgObj = this.ctx.callable('getImage', obj.url);

                if (!imgObj.hasSubimages()) {

                    let id = 'aimg-' + str.slugify(key);
                    //let fullId = path.sep + '#' + id;

                    let schema = Schema.imageObject(id)
                        .url(imgObj.relPath)
                        .contentUrl(imgObj.relPath)
                        .width(imgObj.width)
                        .height(imgObj.height)
                        .representativeOfPage(true);

                    if (spec.licencePage) {
                        schema.acquireLicensePage(spec.licencePage);
                    }

                    if (obj.caption) {
                        schema.caption(obj.caption);
                    }

                    this.coll.add(id, schema);
                    this.articleImages.push(Schema.ref(id));

                    if (!this.articleImagesByTag[key]) {
                        this.articleImagesByTag[key] = [];
                    }

                    this.articleImagesByTag[key].push(Schema.ref(id));

                } else {

                    let keystart = 'aimg-' + str.slugify(key) + '-';

                    for (let subKey of imgObj.subs.keys()) {

                        let id = keystart + subKey;
                        //let fullId = path.sep + '#' + id;

                        let subObj = imgObj.subs.get(subKey);

                        let schema = Schema.imageObject(id)
                            .url(subObj.relPath)
                            .contentUrl(subObj.relPath)
                            .width(subObj.width)
                            .height(subObj.height)
                            .representativeOfPage(true)
                            .thumbnail(Schema.imageObject().url(imgObj.smallest.relPath));

                        if (spec.licencePage) {
                            schema.acquireLicensePage(spec.licencePage);
                        }

                        if (obj.caption) {
                            schema.caption(obj.caption);
                        }

                        this.coll.add(id, schema);
                        this.articleImages.push(Schema.ref(id));

                        if (!this.articleImagesByTag[key]) {
                            this.articleImagesByTag[key] = [];
                        }
    
                        this.articleImagesByTag[key].push(Schema.ref(id));
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

        let schema;
        if (this.article.type == 'post') {
            schema = Schema.blogPosting();
        } else {
            schema = Schema.article();
        }

        schema.id('article')
        //schema.id(path.sep + '#article')
            .name(this.article.name)
            .headline(this.article.headline)
            .url(this.article.url)
            .datePublished(this.article.dates.published.iso)
            .dateModified(this.article.dates.modified.iso)
            .mainEntityOfPage(Schema.ref('webpage'))
            .wordCount(this.article.words)
            .publisher(Schema.ref('publisher'));


        if (this.article.description) {
            schema.description(this.article.description);
        }

        if (this.article.excerpt && this.article.excerptIsSpecified) {
            schema.abstract(this.article.excerpt.text);
        }

        if (this.article.author) {
            let auths = [];
            for (let key of this.article.author) {
                //auths.push(Schema.ref(path.sep + '#author-' + str.slugify(key)));
                auths.push(Schema.ref('author-' + key));
            }
            schema.author(auths);
        }

        if (this.articleImages) {
            schema.image(this.articleImages);
        }

        if (this.articleVideos) {
            schema.video(this.articleVideos);
        }

        this.coll.add('article', schema);

        //schema.check(this.article.relPath);
    }

    /**
     * Process the webpage.
     */
    _processWebpage()
    {
        let schema = Schema.webPage('webpage')
            .name(this.article.name)
            .url(this.article.url)
            .isPartOf(Schema.ref('website'))
            .breadcrumb(Schema.ref('breadcrumb'));


        if (this.article.description) {
            schema.description(this.article.description);
        }

        this.coll.add('webpage', schema);
    }

    /**
     * Process the breadcrumbs.
     */
    _processBreadcrumbs()
    {
        let schema = Schema.breadcrumbList('breadcrumb')
            .name(this.article.name);

        let items = [];

        let bcSpec;

        if (this.article.breadcrumbs) {
            bcSpec = this.article.breadcrumbs;
        } else {
            let as = this.ctx.cfg.articleSpec;
            if (as.defaultBreadcrumbs) {
                bcSpec = as.defaultBreadcrumbs;
            }
        }

        if (!bcSpec) {
            throw new GreenHatSSGArticleError("No breadcrumb specification could be found.");
        }

        let pos = 1;

        for (let part of bcSpec) {

            let item = Schema.listItem().position(pos);

            let extra = null;
            if (part.includes('|')) {
                let sp = part.split('|');
                extra = sp[1];
                part = sp[0];
            }

            switch (part) {
                case ':home':
                
                    item.item(Schema.webPage().name('Home').id(path.sep));
                    pos++;
                    break;

                case ':fn':
                    item.item(Schema.webPage().name(this.article.name).id(this.article.url));
                    pos++;
                    break;

                case ':path':
                    if (this.article.dirname && this.article.dirname != '' && this.article.dirname != '/') {
                        item.item(Schema.webPage().name(
                                str.ucfirst(
                                    str.trimChar(this.article.dirname,path.sep)
                                )
                            )
                            .id(path.join(path.sep, this.article.dirname, path.sep)));
                        pos++;
                    }
                    break;
    
                case ':taxtype':
                    item.item(Schema.webPage().name(str.ucfirst(extra)).id(path.join(path.sep, extra, path.sep)));
                    pos++;

                default:
                    if (part.includes('-')) {
                        let sp = part.split('-');
                        if (sp.length == 2) {
                            if (this.article[sp[0].slice(1)] && (sp[0].slice(1) in this.ctx.cfg.taxonomySpec)) {
                                let num = parseInt(sp[1]);
                                let taxType = sp[0].slice(1);
                                let tax = this.article[taxType][num];
                                item.item(Schema.webPage().name(tax)
                                    .id(path.join(path.sep, taxType, str.slugify(tax), path.sep)));
                                pos++;
                            }
                        }
                    }
            }

            items.push(item);
        }

        schema.itemListElement(items);

        this.coll.add('breadcrumb', schema);
    }

    /**
     * Process the website.
     */
    _processWebsite()
    {
        let schema = Schema.webSite('website')
            .name(this.cfg.site.name)
            .url(path.sep);

        if (this.cfg.site.description) {
            schema.description(this.cfg.site.description);
        }

        if (this.cfg.site.publisher.logo) {
            schema.image(Schema.imageObject().url(this._getImageUrls(this.cfg.site.publisher.logo)));
        }

        if (this.cfg.site.keywords) {
            schema.keywords(this.cfg.site.keywords);
        }

        this.coll.add('website', schema);
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

            let id = 'author-' + str.slugify(authorKey);

            let schema = Schema.person(id)

            for (let key of ['name', 'url']) {
                if (authorObj[key]) {
                    schema.setProp(key, authorObj[key]);
                }
            } 

            if (authorObj['image']) {
                schema.image(Schema.imageObject().url(this._getImageUrls(authorObj['image'])));
            }

            this.coll.add(id, schema);
                
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

        //let schema = Schema.organization(path.sep + '#publisher');
        let schema = Schema.organization('publisher');

        for (let key of ['name', 'url']) {
            if (spec[key]) {
                schema.setProp(key, spec[key]);
            }
        }

        if (spec.logo) {
            schema.logo(Schema.imageObject().url(this._getImageUrls(spec.logo)));
        }

        this.coll.add('publisher', schema);
    }

    /**
     * Parse the schema.
     */
    parse()
    {
        //BaseType.setAddContext(false);

        //let test = Schema.webSite('aaa').name("bbb");
        //syslog.inspect(test.dump());
        //return

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
