/*
 * musicbrainz.js
 * --------------
 * populate couchdb with metadata retrieved from the MusicBrainz XML webservice.
 */

var config = require('./config'),
    _ = require('underscore')._,
    querystring = require('querystring'),
    xml2js = require('xml2js'),
    nano = require('nano'),
    http = require('http');

var musicbrainz_api = {
    hostname: "http://www.musicbrainz.org/",
    port: 80,
    base_path: "/ws/2",
    headers: { "user-agent": config.user_agent },

    lookup: function(entity, mbid, options) {
        return _.extend(this, {
            path: this.base_path + "/" + entity + "/" + mbid + "?" + querystring.stringify(options)
        });
    },

    browse: function(entity, options) {
        return _.extend(this, {
            path: this.base_path + "/" + entity + "?" + querystring.stringify(options)
        });
    },

    search: function(entity, qs, options) {
        var qs_opts = _.extend(options, { query: qs });
        return _.extend(this, {
            path: this.base_path + "/" + entity + "?" + querystring.stringify(qs_opts)
        });
    }
};

// general process:
//     - pull down all artists tagged as hip hop or rap (1 per sec)
//         - if group, later query all members of group (1 per sec)
//     - browse recording info over all retrieved artists
//         - include artist credits in browse req to get featured spots
//     - save docs to couchdb

(function() {
    // initialize nano
    var couch = nano(config.database.host + ":" + config.database.port),
        db = couch.use(config.database.name);
    // TODO: initialize database if it doesn't exist
    var lookup_queue = [],
        found_artists = [];

    // TODO: loop queries, space each one by 1 sec
    // initial query for artists

    // artist + tag search query
    var artist_count = 0,
        artist_page = 0;
    var artist_search = function() {
        http.get(musicbrainz_api.search("artist", "tag:(hip hop OR rap)", { limit: 100, offset: artist_page }), function(res) {
            res.setEncoding("utf8");
            res.on("data", function(chunk) {
                xml2js.parseString(chunk, function(err, body) {
                    if(err)
                        console.log("[ERROR] " + err);
                    var artists = body.metadata["artist-list"][0].artist;
                    artist_count = body.metadata["artist-list"][0].$.count;
                    artist_page += artists.length;
                    _.each(artists, function(artist) {
                        if(!_.contains(found_artists, artist.$.id))
                            lookup_queue.push({ service: "lookup", type: "artist", data: artist });
                    });
                    // keep searching, or move on to lookups
                    if(artist_page < artist_count)
                        setTimeout(artist_search, 1000);
                    else
                        setTimeout(artist_lookup, 1000);
                });
            });
        }).on("error", function(e) {
            console.log("[ERROR] " + e.message);
            setTimeout(artist_search, 1000);
        });
    };
    var artist_lookup = function() {
        // ...
    };

    artist_search();
})();
