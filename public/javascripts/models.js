
var _ = require('underscore')._,
    Backbone = require('backbone'),
    $ = require('jquery').create(),
    config = require('../../config'),
    url = require('url');
Backbone.$ = $; // fuck this b

var CouchModel = Backbone.Model.extend({
    defaults: {
        idAttribute: "_id",
        klass: "CouchModel",
    },

    urlRoot: "/" + config.database.name,

    url: function() {
        return this.urlRoot + "/" + this.get("_id");
    },

    sync: function(method, model, options) {
        // make the database's url explicit
        if(!_.isUndefined(options) && !_.isUndefined(options.url))
            options.url = url.resolve(config.database.url(), options.url);
        else if(_.result(model, 'url'))
            options.url = url.resolve(config.database.url(), _.result(model, 'url'));
        return Backbone.sync.apply(this, [method, model, options]);
    }
});

var CouchCollection = Backbone.Collection.extend({
    toJSON: function() {
        // instead of saving entire objects, save only IDs for fast lookup
        return this.map(function(i) { return { _id: i._id }; });
    }
});

var Track = exports.Track = CouchModel.extend({
    defaults: {
        klass: "Track",
        credits: []
    },

    initialize: function(attrs) {
        if(!_.isUndefined(attrs.mbid))
            this.set({ _id: attrs.mbid });
        if(!_.isUndefined(attrs.name))
            this.set({ name: attrs.name });
        if(!_.isUndefined(attrs.url))
            this.set({ url: attrs.url });
        if(!_.isUndefined(attrs.image))
            this.set({ images: _.map(attrs.image, function(img) {
                return { url: img["#text"], size: img.size };
            }) });
        if(!_.isUndefined(attrs.duration))
            this.set({ duration: parseInt(attrs.duration) });
        if(!_.isUndefined(attrs.playcount))
            this.set({ playcount: parseInt(attrs.playcount) });
        if(!_.isUndefined(attrs.listeners))
            this.set({ listeners: parseInt(attrs.listeners) });
    },

    validate: function(attrs, options) {
        // klass should be Track
        if(!_.isString(attrs.klass) || attrs.klass != "Track")
            return "klass property must be 'Track'."

        // should have a string _id
        if(_.isUndefined(attrs._id) || !_.isString(attrs._id))
            return "must define _id property that is a string."
        // should have a string name
        if(_.isUndefined(attrs.name) || !_.isString(attrs.name))
            return "must define name property that is a string."
        // should have a string url
        if(_.isUndefined(attrs.url) || !_.isString(attrs.url))
            return "must define url property that is a string."
        // should have a string artist
        if(_.isUndefined(attrs.artist) || !_.isString(attrs.artist))
            return "must define artist property that is a string."
        // should have an integer duration
        if(_.isUndefined(attrs.duration) || !_.isString(attrs.duration))
            return "must define duration property that is an integer."
        // should have an integer playcount
        if(_.isUndefined(attrs.playcount) || !_.isString(attrs.playcount))
            return "must define playcount property that is an integer."
        // should have an integer listeners
        if(_.isUndefined(attrs.listeners) || !_.isString(attrs.listeners))
            return "must define listeners property that is an integer."

        // should have images array
        if(_.isUndefined(attrs.images) || !_.isArray(attrs.images))
            return "must define images property that is an array."
        // images should have valid objects
        if(!_.reduce(attrs.images, function(build, img) {
            return build && _.has(img, "url") && _.has(img, "size") &&
                    _.isString(img.url) && _.isString(img.size);
        }, true))
            return "all images must have url and size properties that are strings.";
    }
});

var Artist = exports.Artist = CouchModel.extend({
    defaults: {
        klass: "Artist",
        tracks: new CouchCollection([], { model: Track })
    },

    initialize: function(attrs) {
        if(!_.isUndefined(attrs.mbid))
            this.set({ _id: attrs.mbid });
        if(!_.isUndefined(attrs.name))
            this.set({ name: attrs.name });
        if(!_.isUndefined(attrs.url))
            this.set({ url: attrs.url });
        if(!_.isUndefined(attrs.image))
            this.set({ images: _.map(attrs.image, function(img) {
                return { url: img["#text"], size: img.size };
            }) });
    },

    validate: function(attrs, options) {
        // klass should be Artist
        if(!_.isString(attrs.klass) || attrs.klass != "Artist")
            return "klass property must be 'Artist'."

        // should have a string _id
        if(_.isUndefined(attrs._id) || !_.isString(attrs._id))
            return "must define _id property that is a string."
        // should have a string name
        if(_.isUndefined(attrs.name) || !_.isString(attrs.name))
            return "must define name property that is a string."
        // should have a string url
        if(_.isUndefined(attrs.url) || !_.isString(attrs.url))
            return "must define url property that is a string."

        // should have images array
        if(_.isUndefined(attrs.images) || !_.isArray(attrs.images))
            return "must define images property that is an array."
        // images should have valid objects
        if(!_.reduce(attrs.images, function(build, img) {
            return build && _.has(img, "url") && _.has(img, "size") &&
                    _.isString(img.url) && _.isString(img.size);
        }, true))
            return "all images must have url and size properties that are strings.";
    },

    parse: function(resp, options) {
        var orig = Backbone.Model.parse.apply(this, [resp, options]);
        var result = _.clone(orig);
        // build collections
        result.tracks = this.tracks;
        result.tracks.add(orig.tracks);
        result.tracks.fetch();

        return result;
    },

    toJSON: function() {
        return _.extend(this.attributes, { tracks: this.tracks.toJSON() });
    }
});
