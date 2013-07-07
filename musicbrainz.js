/*
 * musicbrainz.js
 * --------------
 * populate couchdb with metadata retrieved from the MusicBrainz XML webservice.
 */

var config = require('./config'),
    _ = require('underscore')._,
    querystring = require('querystring'),
    xml2js = require('xml2js'),
    nano = require('nano');

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


})();
