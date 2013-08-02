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
    nano = require('nano'),
    http = require('http'),
    vargs = require('vargs').Constructor,
    Artist = require('./public/javascripts/models').Artist,
    Track = require('./public/javascripts/models').Track;

/*
 * script-specific config
 */
config = _.extend(config, {
    development: {
        limit: {
            artists: 500,
            tracks: 100
        }
    },

    production: {
        limit: {
            artists: 500,
            tracks: 100
        }
    },

    test: {
        limit: {
            artists: 5,
            tracks: 5
        }
    }
}[process.env.NODE_ENV]);

/*
 * Last.fm API singleton.
 * (not a general API, only implements needed functions)
 */
var lastfm = new (function() {
    var self = this;
    this.hostname = "ws.audioscrobbler.com";
    this.port = 80;
    this.base_path = "/2.0";
    this.headers = { "user-agent": config.user_agent };
    this.api_key = config.lastfm.api_key;

    this.artist = {
        /*
         * ---------------------------------------------------------
         * artist.get_top_tracks: endpoint for LastFM's getTopTracks
         * ---------------------------------------------------------
         *     args:
         *         mbid: musicbrainz ID of the artist
         *         [options]: additional parameters for the url's query string
         *         callback: function executed on data receipt
         * ---------------------------------------------------------
         */

        get_top_tracks: function() {
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
            return http.get(_.extend(self, { path: path }), callback);
        }
    };

    this.tag = {
        /*
         * --------------------------------------------------------
         * tag.get_top_artists: endpoint for LastFM's getTopArtists
         * --------------------------------------------------------
         *     args:
         *         tagname: name of the tag on LastFM
         *         [options]: additional parameters for the url's query string
         *         callback: function executed on data receipt
         * --------------------------------------------------------
         */

        get_top_artists: function() {
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
            return http.get(_.extend(self, { path: path }), callback);
        }
    };
})();

/*
 * MusicBrainz API singleton.
 * (not a general API, only implements needed functions)
 */
var musicbrainz = new (function() {
    var self = this;
    this.hostname = "www.musicbrainz.org";
    this.port = 80;
    this.base_path = "/ws/2";
    this.headers = { "user-agent": config.user_agent };

    /*
     * --------------------------------------------------
     * lookup: endpoint for musicbrainz lookup webservice
     * --------------------------------------------------
     *     args:
     *         entity: the class of musicbrainz entities (e.g. artist, recording, release, ...)
     *         mbid: musicbrainz ID of the entity
     *         [options]: additional parameters for the url's query string
     *         callback: function executed on data receipt
     * --------------------------------------------------
     */

    this.lookup = function() {
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
        return http.get(_.extend(self, { path: path }), callback);
    };

    /*
     * --------------------------------------------------
     * browse: endpoint for musicbrainz browse webservice
     * --------------------------------------------------
     *     args:
     *         entity: the class of musicbrainz entities (e.g. artist, recording, release, ...)
     *         [options]: additional parameters for the url's query string
     *         callback: function executed on data receipt
     * --------------------------------------------------
     */

    this.browse = function() {
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
        return http.get(_.extend(self, { path: path }), callback);
    };

    /*
     * --------------------------------------------------
     * search: endpoint for musicbrainz search webservice
     * --------------------------------------------------
     *     args:
     *         entity: the class of musicbrainz entities (e.g. artist, recording, release, ...)
     *         querystring: Lucene-style querystring for musicbrainz searchs
     *         [options]: additional parameters for the url's query string
     *         callback: function executed on data receipt
     * --------------------------------------------------
     */

    this.search = function() {
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
        var path = self.base_path + "/" + entity + "?" + querystring.stringify(options);
        return http.get(_.extend(self, { path: path }), callback);
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
    var artists = new Backbone.Collection([], { model: Artist });

    /*
     * --------------------------------------------------------------------- 
     * handle_top_artists: process JSON from getTopArtists requests and save
     *         results to CouchDB via appropriate Backbone models.
     * --------------------------------------------------------------------- 
     *     args:
     *         request: raw request_queue object
     *         response: JSON response received from LastFM
     *     returns:
     *         an array of mbids of all artists processed
     * --------------------------------------------------------------------- 
     */

    // TODO: artist_mbids doesn't contain anything due to asynchronicity.
    // instead, have save_success push the query object request directly and
    // have request_queue.next spin until it gets a new request. the script
    // will then terminate on special 'quit' request.
    var handle_top_artists = function(request, response) {
        var req_artists = response.topartists.artist,
            artist_mbids = [];
        _.each(req_artists, function(artist_json) {
            // check validity of found json
            artist_json = Artist.from_lastfm(artist_json);
            var test_artist = new Artist(artist_json);
            if(!test_artist.isValid())
                console.log("Submitted artist JSON is not valid (" + test_artist.validationError + ")");
            else {
                var artist = new Artist({ _id: artist_json._id }),
                    save_success = function(m, r, o) {
                        debugger;
                        console.log("Successfully saved artist " + m.get("_id") + "!");
                        artists.add(m);
                    }, save_error = function(m, r, o) {
                        debugger;
                        console.log("Could not save artist " + m.get("_id"));
                    };
                // save after fetching to ensure we have a _rev
                artist.fetch({
                    // success: model already existed, update
                    "success": function(model, response, options) {
                        model.save(artist_json, { "success": save_success, "error": save_error });
                    },
    
                    // error: model didn't exist, create
                    "error": function(model, response, options) {
                        console.log("Problem fetching artist " + artist.get("_id") + " from database.");
                        artist.save(artist_json, { "success": save_success, "error": save_error });
                    }
                });
                // add artist to request queue
                artist_mbids.push(artist.get("_id"));
            }
        });
        
        return artist_mbids;
    };

    /*
     * --------------------------------------------------------------------- 
     * handle_top_tracks: process JSON from getTopTracks requests and save
     *         results to CouchDB via appropriate Backbone models.
     * --------------------------------------------------------------------- 
     *     args:
     *         request: raw request_queue object
     *         response: JSON response received from LastFM
     *     returns:
     *         an array of mbids of all tracks processed
     * --------------------------------------------------------------------- 
     */

    var handle_top_tracks = function(request, response) {
        var req_tracks = response.toptracks.track,
            track_mbids = [];
        _.each(req_tracks, function(track_json, i) {
            // don't add more tracks than were asked for!
            if(request.max > request.limit * (request.page - 1) + i) {
                // check validity of track
                track_json = Track.from_lastfm(track_json);
                var test_track = new Track(track_json);
                if(!test_track.isValid())
                    console.log("Submitted track JSON is not valid (" + test_track.validationError + ")");
                else {
                    var track = new Track({ _id: track_json._id }),
                        save_success = function(m, r, o) {
                            console.log("Successfully saved track " + m.get("_id") + "!");
                            artists.get(request.artist).get("tracks").add(m);
                        }, save_error = function(m, r, o) {
                            console.log("Could not save track " + m.get("_id"));
                        };
                    // save after fetching to ensure we have a _rev
                    track.fetch({
                        // success: model already existed, update
                        "success": function(model, response, options) {
                            model.save(track_json, { "success": save_success, "error": save_error });
                        },
        
                        // error: model didn't exist, create
                        "error": function(model, response, options) {
                            console.log("Problem fetching track " + track.get("_id") + " from database.");
                            track.save(track_json, { "success": save_success, "error": save_error });
                        }
                    });
                    // add track to request queue
                    track_mbids.push(track.get("_id"));
                }
            }
        });
        
        return track_mbids;
    };

    /*
     * --------------------------------------------------------------------- 
     * handle_search_recordings: process JSON from musicbrainz recordings
     *         search requests and save artist credits to appropriate tracks.
     * --------------------------------------------------------------------- 
     *     args:
     *         request: raw request_queue object
     *         response: JSON response received from MusicBrainz
     *     returns:
     *         a search_recordings stats object: {
     *             count: total number of recordings found for this query
     *             tracks: array of mbids of all tracks processed in this page
     *         }        
     * --------------------------------------------------------------------- 
     */

    var handle_search_recordings = function(request, response) {
        var req_search = response.recording,
            track_stats = {
                count: response.count,
                tracks: _.map(response.recording, function(r) { return r._id; })
            };
        _.each(req_search, function(track_json) {
            var artist_id = request.artist,
                track_id = track_json.id;
            // only handle this track if we found it on last.fm
            if(artists.get(artist_id) && _.indexOf(request.tracks, track_id) > -1) {
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
                    var track_credits = artists.get(artist_id).get("tracks").get(track_id).credits;
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
     * -------------------------------------------------------------------
     * request_queue: singleton object that queues requests to last.fm and
     *     MusicBrainz APIs over a predefined workflow. The queue's workflow is
     *     broken down into discrete stages, each of which is executed in a
     *     specific order.
     *
     *     Workflow:
     *         top_artists_fn: get 500 top artists with tag "hip-hop" (1 reqs)
     *         top_tracks_fn: get 100 top tracks for every artist (1 x 500 reqs)
     *         search_recordings_fn: get artists credits for all known tracks
     *             (god knows how many reqs)
     * -------------------------------------------------------------------
     */
    var request_queue = new (function(top_artists_fn, top_tracks_fn, search_recordings_fn) {
        if(!_.isFunction(top_artists_fn) || !_.isFunction(top_tracks_fn) || !_.isFunction(search_recordings_fn))
            console.log("[ERROR] request_queue requires three callback functions.");
        else {
            var self = this;
            // callbacks: convenience mapping of requests to callbacks.
            this.callbacks = {
                "top_artists": top_artists_fn,
                "top_tracks": top_tracks_fn,
                "search_recordings": search_recordings_fn
            };
            // requests: queue of request metadata.
            //     initially contains first query to be executed. (top_artists)
            this.requests = [{ // initially seeded with top_artists query
                type: "top_artists",
                limit: config.limit.artists
            }];
            // completed: tracks number of requests of each type totally completed
            this.completed = {
                "top_artists": 0,
                "top_tracks": 0,
                "search_recordings": 0
            };
            // ticks: time (in ms) to delay requests, to avoid rate limiting
            this.ticks = {
                lastfm: 200,
                musicbrainz: 1000
            };
            // last_tick: needed when queue is empty
            this.last_tick = this.ticks.lastfm;

            /*
             * -----------------------------------------------------
             * next: execute the next request available in the queue
             *         [aliases: run]
             * -----------------------------------------------------
             */

            this.next = this.run = function() {
                debugger;
                if(this.requests.length <= 0) {
                    console.log("Request queue empty; trying again in " + this.last_tick + " ms");
                    setTimeout(_.bind(this.next, this), this.last_tick);
                    return true;
                }

                var req = this.requests[0];
                this.requests = _.rest(this.requests);

                if(req.type == "top_artists")
                    this.top_artists(req);
                else if(req.type == "top_tracks")
                    this.top_tracks(req);
                else if(req.type == "search_recordings")
                    this.search_recordings(req);
                else if(req.type == "quit") {
                    console.log("All queries handled! Saving...");
                    artists.each(function(artist) {
                        artist.save();
                    });
                    return true;
                } else {
                    console.log("[ERROR] request type '" + req.type + "' unknown to request_queue.");
                    return false;
                }

                console.log("Request issued: " + JSON.stringify(req));
            };

            /*
             * ------------------------------------------------------------
             * top_artists: issue a getTopArtists request to LastFM and add
             *         more queries to the queue based on the results
             * ------------------------------------------------------------
             *     args:
             *         req: a requeust_queue object
             * ------------------------------------------------------------
             */
             
            this.top_artists = function(req) {
                var options = _.pick(req, "limit");
                // issue getTopArtists request to LastFM for tag hip-hop
                lastfm.tag.get_top_artists("hip-hop", options, function(res) {
                    var json_response = "";
                    res.setEncoding("utf8");
                    res.on("data", function(chunk) {
                        json_response += chunk;
                    });
                    res.on("end", function() {
                        var response = JSON.parse(json_response);
                        if(_.has(response, "error"))
                            console.log("[ERROR] From last.fm: '" + response.error + ": " + response.message + "'");
                        else {
                            console.log("Successful response from last.fm. " + JSON.stringify(req));
                            // add getTopTracks requests to queue based on callback results
                            var artist_mbids = self.callbacks[req.type](req, response);
                            _.chain(artist_mbids).map(function(mbid) {
                                return { type: "top_tracks", artist: mbid, limit: config.limit.tracks, page: 1, max: config.limit.tracks };
                            }).each(function(request) {
                                self.requests.push(request);
                            }).value();
                            self.completed.top_artists++;
                            setTimeout(_.bind(self.next, self), self.ticks.lastfm);
                        }
                    });
                }).on('error', function(e) {
                    
                    console.log("Error encountered: " + e.message);
                    console.log(e.stack);
                    console.log(JSON.stringify(e));
                });
            };

            /*
             * ---------------------------------------------------------------
             * top_tracks: issue a getTopTracks request to LastFM and add more
             *         queries to the queue based on the results
             * ---------------------------------------------------------------
             *     args:
             *         req: a requeust_queue object
             * ---------------------------------------------------------------
             */
            
            this.top_tracks = function(req) {
                var options = _.pick(req, "limit", "page");
                // issue getTopTrakcss request to LastFM for given artist
                lastfm.artist.get_top_tracks(req.artist, options, function(res) {
                    var json_response = "",
                        all_tracks = [];
                    res.setEncoding("utf8");
                    res.on("data", function(chunk) {
                        json_response += chunk;
                    });
                    res.on("end", function() {
                        var response = JSON.parse(json_response);
                        if(_.has(response, "error"))
                            console.log("[ERROR] From last.fm: '" + response.error + ": " + response.message + "'");
                        else {
                            console.log("Successful response from last.fm. " + JSON.stringify(req));
                            // add getTopTracks requests to queue based on callback results
                            var track_mbids = self.callbacks[req.type](req, response),
                                last_page = parseInt(response.toptracks["@attr"].totalPages);
                            all_tracks = _.union(all_tracks, track_mbids);
                            if(req.max <= track_mbids.length + req.limit * (req.page - 1) || req.page >= last_page) {
                                console.log("Found " + req.max + " top tracks for " + req.artist + "; continuning...");
                                self.completed.top_tracks++;
                                // add first search_recordings request ONLY ONCE
                                self.requests.push({
                                    type: "search_recordings",
                                    artist: req.artist,
                                    tracks: all_tracks,
                                    limit: 100,
                                    page: 1
                                });
                            } else {
                                // add next top tracks page request BEFORE track requests
                                var next_req = _.extend(req, { page: req.page + 1});
                                self.requests.push(next_req);
                            }
                            
                            setTimeout(_.bind(self.next, self), self.ticks.lastfm);
                        }
                    });
                }).on('error', function(e) {
                    console.log("Error encountered: " + e.message);
                    console.log(e.stack);
                    console.log(JSON.stringify(e));
                });
            };

            /*
             * --------------------------------------------------------------
             * search_recordings: issue a recordings search request to
             *         MusicBrainz and add more queries to the queue based on
             *         the results
             * --------------------------------------------------------------
             *     args:
             *         req: a requeust_queue object
             * --------------------------------------------------------------
             */
            
            this.search_recordings = function(req) {
                var options = { limit: req.limit, offset: req.page * req.limit, inc: "artist-credits" };
                // issue search for recordings with given artist
                musicbrainz.search("recording", "arid:" + req.artist, options, function(res) {
                    var json_response = "";
                    res.setEncoding("utf8");
                    res.on("data", function(chunk) {
                        json_response += chunk;
                    });
                    res.on("end", function() {
                        var response = JSON.parse(json_response);
                        // possibly add more pages of this request
                        var track_stats = self.callbacks[req.type](req, response);
                        if(track_stats.count <= track_stats.tracks.length + req.limit * (req.page - 1)) {
                            console.log("Found credits for " + track_stats.count + " tracks by " + req.artist + "; continuing...");
                            // check if this was the final request
                            self.completed.search_recordings++;
                        } else {
                            var next_req = _.extend(req, { page: req.page + 1});
                            self.requests.push(next_req);
                        }
                        // set quit event if all artists are done being queried
                        if(self.completed.search_recordings >= artists.length)
                            self.requests.push({ type: "quit" });
                        setTimeout(_.bind(self.next, self), self.ticks.musicbrainz);
                    });
                }).on('error', function(e) {
                    console.log("Error encountered: " + e.message);
                    console.log(e.stack);
                    console.log(JSON.stringify(e));
                });
            };
        }
    })(handle_top_artists, handle_top_tracks, handle_search_recordings);

    // run it
    request_queue.run();
})();
