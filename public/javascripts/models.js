
var _ = require('underscore')._,
    Backbone = require('backbone');

var CouchModel = Backbone.Model.extend({
    /* custom sync stuff goes here! */
    defaults: {
        klass: "CouchModel"
    }
});

exports.Artist = CouchModel.extend({
    defaults: {
        klass: "Artist"
    },

    initialize: function(attrs) {
        // ...
    },

    validate: function(attrs, options) {
        // ...
    }
});

exports.Track = CouchModel.extend({
    defaults: {
        klass: "Track"
    },

    initialize: function(attrs) {
        // ...
    },

    validate: function(attrs, options) {
        // ...
    }
});