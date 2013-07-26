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
        options = has_options ? _.extend({ fmt: "json" }, options) : { fmt: "json" };
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
        options = has_options ? _.extend({ fmt: "json" }, options) : { fmt: "json" };
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
        options = has_options ? _.extend({ fmt: "json" }, options) : { fmt: "json" };
        options = _.extend({ query: qs }, options);
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

    /*
     * Workflow callbacks
     *     handle_top_artists: get 500 top artists with tag "hip-hop" (1 reqs)
     *     handle_top_tracks: get 100 top tracks for every artist (1 x 500 reqs)
     *     handle_search_recordings: get artists credits for all known tracks (god knows how many reqs)
     */
    var handle_top_artists = function(request, response) {
        var req_artists = response.topartists.artist,
            artist_mbids = [];
        _.each(req_artists, function(artist_json) {
            var artist = new Artist({ _id: artist_json.mbid }),
                save_success = function(m, r, o) {
                    console.log("Successfully saved " + m._id + "!");
                    artist_mbids.push(m._id);
                    artists.add(m);
                }, save_error = function(m, r, o) {
                    console.log("Could not save " + m._id);
                };
            // save after fetching to ensure we have a _rev
            artist.fetch({
                // success: model already existed, update
                "success": function(model, response, options) {
                    model.save(artist_json, { "success": save_success, "error": save_error });
                },

                // error: model didn't exist, create
                "error": function(model, response, options) {
                    console.log("Problem fetching artist " + artist._id + " from database.");
                    artist.save(artist_json, { "success": save_success, "error": save_error });
                }
            });
        });
        
        return artist_mbids;
    };

    var handle_top_tracks = function(request, response) {
        var req_tracks = response.toptracks.track,
            track_mbids = [];
        _.each(req_tracks, function(track_json, i) {
            // don't add more tracks than were asked for!
            if(request.max > request.limit * (request.page - 1) + i) {
                var track = new Track({ _id: track_json.mbid }),
                    save_success = function(m, r, o) {
                        console.log("Successfully saved " + m._id + "!");
                        track_mbids.push(m._id);
                        artists.get(request.artist).tracks.add(m);
                    }, save_error = function(m, r, o) {
                        console.log("Could not save " + m._id);
                    };
                // save after fetching to ensure we have a _rev
                track.fetch({
                    // success: model already existed, update
                    "success": function(model, response, options) {
                        model.save(track_json, { "success": save_success, "error": save_error });
                    },
    
                    // error: model didn't exist, create
                    "error": function(model, response, options) {
                        console.log("Problem fetching artist " + artist._id + " from database.");
                        track.save(track_json, { "success": save_success, "error": save_error });
                    }
                });
            }
        });
        
        return track_mbids;
    };

    var handle_search_recordings = function(request, response) {
        var req_search = response.recording,
            track_stats = {
                count: response.count
                 tracks: _.map(response.recording, function(r) { return r._id; })
             };
        _.each(req_search, function(track_json) {
            var artist_id = request.artist,
                track_id = track_json.id;
            // only handle this track if we found it on last.fm
            if(artists.get(artist_id) && artists.get(artist_id).tracks.get(track_id)) {
                // iterate over all artist credits
                var artist_credits = response.recording["artist-credit"];
                _.each(artist_credits, function(credit_json) {
                    var credit = {
                        id: credit_json.artist.id,
                        name: credit_json.artist.name,
                        sort_name: credit_json.artist.sort_name,
                        credit_name: credit_json.name,
                        joinphrase: credit_json.joinphrase
                    };
                    var track_credits = artists.get(artist_id).tracks.get(track_id).credits;
                    track_credits = _.union([credit], track_credits);
                    artists.get(artist_id).set("tracks", track_credits);
                });
                // save all credits
                artists.get(artist_id).tracks.save();
            }
        });

        return track_stats;
    };

    /*
     * request_queue: singleton object that queues requests to last.fm and
     *     MusicBrainz APIs over a predefined workflow. 
     */
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

                if(req.type == "top_artists")
                    self.top_artists(req);
                else if(req.type == "top_tracks")
                    self.top_tracks(req);
                else if(req.type == "search_recordings")
                    self.search_recordings(req);
                else {
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
                        var track_mbids = self.callbacks[req.type](req, response),
                            last_page = parseInt(response.toptracks.track["@attr"].totalPages);
                        if(req.max <= track_mbids.length + req.limit * (req.page - 1) || req.page >= last_page)
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
                    var response = JSON.parse(chunk);
                    var track_stats = self.callbacks[req.type](req, response);
                    if(track_stats.count <= track_stats.tracks.length + req.limit * (req.page - 1))
                        console.log("Found credits for " + track_stats.count + " tracks by " + req.artist + "; continuing...");
                    else {
                        var next_req = _.extend(req, { page: req.page + 1});
                        self.requests.push(next_req);
                    }
                    setTimeout(self.next, self.ticks.musicbrainz);
                });
            };
        }
    })(handle_top_artists, handle_top_tracks, handle_search_recordings);

    // run it
    request_queue.run();
})();
