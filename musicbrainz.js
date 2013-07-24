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
    http = require('http'),
    vargs = require('vargs').Constructor;

var musicbrainz_api = {
    hostname: "http://www.musicbrainz.org/",
    port: 80,
    base_path: "/ws/2",
    headers: { "user-agent": config.user_agent },

    lookup: function(/* entity, mbid, [options,] callback */) {
        var args = new (vargs)(arguments);
        if(!args.callbackGiven()) {
            console.log("[ERROR] musicbrainz API functions need a valid callback function.")
            return null;
        }

        var entity = args.first,
            mbid = args.at(1),
            options = args.last,
            callback = args.callback,
            hasOptions = args.length > 2;
        var path = this.base_path + "/" + entity + "/" + mbid + (hasOptions ? "?" + querystring.stringify(options) : "");
        return http.get(_.extend(this, { path: path }), function(res) {
            res.setEncoding("utf8");
            res.on("data", callback);
        });
    },

    browse: function(/* entity, [options,] callback */) {
        var args = new (vargs)(arguments);
        if(!args.callbackGiven()) {
            console.log("[ERROR] musicbrainz API functions need a valid callback function.")
            return null;
        }
        
        var entity = args.first,
            options = args.last,
            callback = args.callback,
            hasOptions = args.length > 1;
        var path = this.base_path + "/" + entity + (hasOptions ? "?" + querystring.stringify(options) : "");
        return http.get(_.extend(this, { path: path }), function(res) {
            res.setEncoding("utf8");
            res.on("data", callback);
        });
    },

    search: function(/* entity, querystring, [options,] callback */) {
        var args = new (vargs)(arguments);
        if(!args.callbackGiven()) {
            console.log("[ERROR] musicbrainz API functions need a valid callback function.")
            return null;
        }
        
        var entity = args.first,
            qs = args.at(1),
            options = args.last,
            callback = args.callback,
            hasOptions = args.length > 2;
        var qs_opts = hasOptions ? _.extend(options, { query: qs }) : { query: qs };
        var path = this.base_path + "/" + entity + "?" + querystring.stringify(qs_opts);
        return http.get(_.extend(this, { path: path }), function(res) {
            res.setEncoding("utf8");
            res.on("data", callback);
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
    /*var lookup_queue = [],
        found_artists = [];*/
    var artist_ids = [];

    // TODO: loop queries, space each one by 1 sec
    // initial query for artists

    var request_queue = function(/* artist_callback, release_callback  */) {
        var args = new (vargs)(arguments);
        if(args.length <= 0 || !args.callbackGiven())
            console.log("[ERROR] request_queue requires two callback functions.");
        else {
            this.artist_callback = args.first;
            this.release_callback = args.callback;
            this.requests = [];
            this.tick = 1000; // # millis to wait between reqs
            this.page = 0;
            this.count = 0;

            this.next = this.run = function() {
                var req = this.requests[0];
                this.requests = _.rest(this.requests);

                if(req.type == "artist search") {

                } else if(req.type == "release browse") {

                }
            };
        }
    };
    var artist_search = function(/* ... */) {
        musicbrainz_api.search("artist", "tag:(hip hop OR rap)", { limit: 100, offset: artist_page }, function(chunk) {
            xml2js.parseString(chunk, function(err, body) {
                if(err)
                    console.log("[ERROR] " + err);
                var artists = body.metadata["artist-list"][0].artist;
                artist_count = body.metadata["artist-list"][0].$.count;
                artist_page += artists.length;
                _.each(artists, function(artist) {
                    if(!_.contains(found_artists, artist.$.id)) {
                        lookup_queue.push({ type: "artist", data: artist });
                        found_artists = _.union(found_artists, [artist.$.id]);
                    }
                });
                // keep searching, or move on to lookups
                if(artist_page < artist_count)
                    setTimeout(artist_search, 1000);
                else
                    setTimeout(artist_lookup, 1000);
            });
        }).on("error", function(e) {
            console.log("[ERROR] " + e.message);
            setTimeout(artist_search, 1000);
        });
    };
    var artist_lookup = function(/* ... */) {
        var artist = lookup_queue[0];
        lookup_queue = _.rest(lookup_queue);
        musicbrainz_api.browse("recording", { limit: 100 }, function(chunk) {

        });
    };

    artist_search();
})();
