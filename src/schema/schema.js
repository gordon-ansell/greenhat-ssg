/**
 * @file        Base schema builder.
 * @module      Schema
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./objects/thing");
const CreativeWork = require("./objects/creativeWork");
const MediaObject = require("./objects/mediaObject");
const ImageObject = require("./objects/imageObject");
const VideoObject = require("./objects/videoObject");
const WebSite = require("./objects/webSite");
const Organization = require("./objects/organization");
const WebPage = require("./objects/webPage");
const Article = require("./objects/article");
const SocialMediaPosting = require("./objects/socialMediaPosting");
const BlogPosting = require("./objects/blogPosting");
const Person = require("./objects/person");
const ItemList = require("./objects/itemList");
const BreadcrumbList = require("./objects/breadcrumbList");
const ListItem = require("./objects/listItem");
const Product = require("./objects/product");
const SoftwareApplication = require("./objects/softwareApplication");
const Movie = require("./objects/movie");
const LocalBusiness = require("./objects/localBusiness");
const TVSeries = require("./objects/tvSeries");
const MusicPlaylist = require("./objects/musicPlaylist");
const MusicAlbum = require("./objects/musicAlbum");
const MusicRecording = require("./objects/musicRecording");
const Offer = require("./objects/offer");
const Review = require("./objects/review");
const Rating = require("./objects/rating");
const AggregateRating = require("./objects/aggregateRating");
const Event = require('./objects/event');
const Place = require('./objects/place');
const MusicGroup = require("./objects/musicGroup");
const HowTo = require("./objects/howTo");
const HowToStep = require("./objects/howToStep");
const BaseType = require("./baseType");
const { syslog } = require("greenhat-util/syslog");

class Schema
{
    /**
     * Create a reference.
     * 
     * @param   {string}    val     Value.
     */
    static ref(val)
    {
        return { '@id': val };
    }

    // -----------------------------------------------------------------
    // Create the various schemas.
    // -----------------------------------------------------------------

    static thing(id = null) {return new Thing(id);}

        static creativeWork(id = null) {return new CreativeWork(id);}

            static webSite(id = null) {return new WebSite(id);}

            static webPage(id = null) {return new WebPage(id);}

            static article(id = null) {return new Article(id);}

                static socialMediaPosting(id = null) {return new SocialMediaPosting(id);}

                    static blogPosting(id = null) {return new BlogPosting(id);}

            static mediaObject(id = null){return new MediaObject(id);}

                static imageObject(id = null) {return new ImageObject(id);}

                static videoObject(id = null) {return new VideoObject(id);}

            static softwareApplication(id = null) {return new SoftwareApplication(id);}

            static movie(id = null) {return new Movie(id);}

            static tvSeries(id = null) {return new TVSeries(id);}

            static musicPlaylist(id = null) {return new MusicPlaylist(id);}

                static musicAlbum(id = null) {return new MusicAlbum(id);}

            static musicRecording(id = null) {return new MusicRecording(id);}

            static review(id = null) {return new Review(id);}

            static howTo(id = null) {return new HowTo(id);}

            static howToStep(id = null) {return new HowToStep(id);}

        static organization(id = null) {return new Organization(id);}

            static localBusiness(id = null) {return new LocalBusiness(id);}

            static musicGroup(id = null) {return new MusicGroup(id);}

        static person(id = null) {return new Person(id);}

        static itemList(id = null) {return new ItemList(id);}

            static breadcrumbList(id = null) {return new BreadcrumbList(id);}

        static listItem(id = null) {return new ListItem(id);}

        static product(id = null) {return new Product(id);}

        static event(id = null) {return new Event(id);}

        static place(id = null) {return new Place(id);}

        static offer(id = null) {return new Offer(id);}

        static rating(id = null) {return new Rating(id);}

            static aggregateRating(id = null) {return new AggregateRating(id);}
}

module.exports = Schema;
