/*
 * metadata.js
 * --------------
 * populate databse with metadata retrieved from the MusicBrainz XML webservice
 * and Last.fm API.
 */

var config = require('./config'),
    _ = require('underscore')._,
    Backbone = require('backbone'),
    querystring = require('querystring'),
    xml2js = require('xml2js'),
    nano = require('nano'),
    http = require('http'),
    vargs = require('vargs').Constructor,
    Artist = require('public/javascripts/models').Artist,
    Track = require('public/javascripts/models').Track;

/*
 * Last.fm API singleton.
 * (not a general API, only implements needed functions)
 */
var lastfm = new (function() {
    var self = this;
    this.hostname = "http://ws.audioscrobbler.com/";
    this.port = 80;
    this.base_path = "/2.0";
    this.headers = { "user-agent": config.user_agent };
    this.api_key = config.lastfm.api_key;

    this.artist = {
        get_top_tracks: function(/* mbid, [options,] callback */) {
            var args = new (vargs)(arguments);
            if(!args.callbackGiven()) {
                console.log("[ERROR] last.fm API functions need a valid callback function.")
                return null;
            }

            var mbid = args.first,
                options = args.last,
                callback = args.callback,
                has_options = args.length > 1;
            var default_params = {
                method: "artist.getTopTracks",
                api_key: self.api_key,
                format: "json",
                mbid: mbid
            };
            var query_params = has_options ? _.extend(options, default_params) : default_params;
            var path = self.base_path + "?" + querystring.stringify(query_params);
            return http.get(_.extend(self, { path: path }), function(res) {
                res.setEncoding("utf8");
                res.on("data", callback);
            });
        }
    };

    this.tag = {
        get_top_artists: function(/* tagname, [options,] callback */) {
            var args = new (vargs)(arguments);
            if(!args.callbackGiven()) {
                console.log("[ERROR] last.fm API functions need a valid callback function.")
                return null;
            }

            var tag = args.first,
                options = args.last,
                callback = args.callback,
                has_options = args.length > 1;
            var default_params = {
                method: "tag.getTopArtists",
                api_key: self.api_key,
                format: "json",
                tag: tag
            };
            var query_params = has_options ? _.extend(options, default_params) : default_params;
            var path = self.base_path + "?" + querystring.stringify(query_params);
            return http.get(_.extend(self, { path: path }), function(res) {
                res.setEncoding("utf8");
                res.on("data", callback);
            });
        }
    };
})();

/*
 * MusicBrainz API singleton.
 */
var musicbrainz = new (function() {
    var self = this;
    this.hostname = "http://www.musicbrainz.org/";
    this.port = 80;
    this.base_path = "/ws/2";
    this.headers = { "user-agent": config.user_agent };

    this.lookup = function(/* entity, mbid, [options,] callback */) {
        var args = new (vargs)(arguments);
        if(!args.callbackGiven()) {
            console.log("[ERROR] musicbrainz API functions need a valid callback function.")
            return null;
        }

        var entity = args.first,
            mbid = args.at(1),
            options = args.last,
            callback = args.callback,
            has_options = args.length > 2;
        var path = self.base_path + "/" + entity + "/" + mbid + (has_options ? "?" + querystring.stringify(options) : "");
        return http.get(_.extend(self, { path: path }), function(res) {
            res.setEncoding("utf8");
            res.on("data", callback);
        });
    };

    this.browse = function(/* entity, [options,] callback */) {
        var args = new (vargs)(arguments);
        if(!args.callbackGiven()) {
            console.log("[ERROR] musicbrainz API functions need a valid callback function.")
            return null;
        }
        
        var entity = args.first,
            options = args.last,
            callback = args.callback,
            has_options = args.length > 1;
        var path = self.base_path + "/" + entity + (has_options ? "?" + querystring.stringify(options) : "");
        return http.get(_.extend(self, { path: path }), function(res) {
            res.setEncoding("utf8");
            res.on("data", callback);
        });
    };

    this.search = function(/* entity, querystring, [options,] callback */) {
        var args = new (vargs)(arguments);
        if(!args.callbackGiven()) {
            console.log("[ERROR] musicbrainz API functions need a valid callback function.")
            return null;
        }
        
        var entity = args.first,
            qs = args.at(1),
            options = args.last,
            callback = args.callback,
            has_options = args.length > 2;
        var qs_opts = has_options ? _.extend(options, { query: qs }) : { query: qs };
        var path = self.base_path + "/" + entity + "?" + querystring.stringify(qs_opts);
        return http.get(_.extend(self, { path: path }), function(res) {
            res.setEncoding("utf8");
            res.on("data", callback);
        });
    };
})();

// general process:
//     - pull down all artists tagged as hip hop or rap (1 per sec)
//         - if group, later query all members of group (1 per sec)
//     - browse recording info over all retrieved artists
//         - include artist credits in browse req to get featured spots
//     - save docs to couchdb

(function() {
    // initialize nano
    var couch = nano(config.database.host + ":" + config.database.port),
        db = couch.use(config.database.name),
        artists = new Backbone.Collection([], { model: Artist });
    // TODO: initialize database if it doesn't exist
    /*var lookup_queue = [],
        found_artists = [];*/

    /*
     * Workflow callbacks
     *     handle_top_artists: get 500 top artists with tag "hip-hop" (1 reqs)
     *     handle_top_tracks: get 100 top tracks for every artist (1 x 500 reqs)
     *     handle_search_recordings: get artists credits for all known tracks (god knows how many reqs)
     */
    var handle_top_artists = function() {

    };

    var handle_top_tracks = function() {

    };

    var handle_search_recordings = function() {

    };

    var request_queue = new (function(top_artists_fn, top_tracks_fn, search_recordings_fn) {
        if(!_.isFunction(top_artists_fn) || !_.isFunction(top_tracks_fn) || !_.isFunction(search_recordings_fn))
            console.log("[ERROR] request_queue requires three callback functions.");
        else {
            var self = this;
            this.callbacks = {
                "top_artists": top_artists_fn,
                "top_tracks": top_tracks_fn,
                "search_recordings": search_recordings_fn
            };
            this.requests = [{ // initially seeded with top_artists query
                type: "top_artists"
                limit: 500
            }];
            this.ticks = {
                lastfm: 200,
                musicbrainz: 1000
            };

            this.next = this.run = function() {
                var req = this.requests[0];
                this.requests = _.rest(this.requests);

                if(req.type == "top_artists") {
                    self.top_artists(req);
                } else if(req.type == "top_tracks") {
                    self.top_tracks(req);
                } else if(req.type == "search_recordings") {
                    self.search_recordings(req);
                } else {
                    console.log("[ERROR] request type '" + req.type + "' unknown to request_queue.");
                    return false;
                }

                console.log("Request issued: " + JSON.stringify(req));
            };

            this.top_artists = function(req) {
                var options = _.pick(req, "limit");
                lastfm.tag.get_top_artists("hip-hop", options, function(chunk) {
                    var response = JSON.parse(chunk);
                    if(_.has(response, "error"))
                        console.log("[ERROR] From last.fm: '" + response.error + ": " + response.message + "'");
                    else {
                        console.log("Successful response from last.fm. " + JSON.stringify(req));
                        var artist_mbids = self.callbacks[req.type](req, response);
                        _.chain(artist_mbids).map(function(mbid) {
                            return { type: "top_tracks", artist: mbid, limit: 100, page: 1, max: 100 };
                        }).each(function(request) {
                            self.requests.push(request);
                        }).value();
                        setTimeout(self.next, self.ticks.lastfm);
                    }
                });
            };

            this.top_tracks = function(req) {
                var options = _.pick(req, "limit", "page");
                lastfm.artist.get_top_tracks(req.artist, options, function(chunk) {
                    var response = JSON.parse(chunk);
                    if(_.has(response, "error"))
                        console.log("[ERROR] From last.fm: '" + response.error + ": " + response.message + "'");
                    else {
                        console.log("Successful response from last.fm. " + JSON.stringify(req));
                        var track_mbids = self.callbacks[req.type](req, response);
                        if(req.max <= track_mbids.length + req.limit * (req.page - 1))
                            console.log("Found " + req.max + " top tracks for " + req.artist + "; continuning...");
                        else {
                            // add next top tracks page request BEFORE track requests
                            var next_req = _.extend(req, { page: req.page + 1});
                            self.requests.push(next_req);
                        }
                        // add track requests
                        _.chain(track_mbids).map(function(mbid) {
                            return {
                                type: "search_recordings",
                                artist: req.artist,
                                track: mbid,
                                limit: 100,
                                page: 1
                            };
                        }).each(function(request) {
                            self.requests.push(request);
                        }).value();
                        setTimeout(self.next, self.ticks.lastfm);
                    }
                });
            };

            this.search_recordings = function(req) {
                var options = { limit: req.limit, offset: req.page * req.limit, inc: "artist-credits" };
                musicbrainz.search("artist", "arid:" + req.artist, options, function(chunk) {
                    xml2js.parseString(chunk, function(err, response) {
                        // TODO: check if response must be JSON.parse'd
                        if(err)
                            console.log("[ERROR] " + err);
                        var track_matches = self.callbacks[req.type](req, response);
                        // ...
                    });
                });
            };
        }
    })(handle_top_artists, handle_top_tracks, handle_search_recordings);



    /*
    var artist_search = function() {
        musicbrainz.search("artist", "tag:(hip hop OR rap)", { limit: 100, offset: artist_page }, function(chunk) {
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
    var artist_lookup = function() {
        var artist = lookup_queue[0];
        lookup_queue = _.rest(lookup_queue);
        musicbrainz.browse("recording", { limit: 100 }, function(chunk) {

        });
    };
    */
})();
