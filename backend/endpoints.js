/*
 * endpoints.js
 * --------------
 * middleman between Cloudant's CouchDB and Backbone models. Basically,
 * Cloudant requires more complex authentication than I can give. Technically,
 * I could crack open the Backbone internals to fix that, but in the immortal
 * words of Oscar Wilde, "fuck that, G"
 */

var _ = require('underscore')._,
	restify = require('restify'),
    config = require('../config');

module.exports = (function() {
	// initialize server, listens on 4187
	var endpoints = restify.createServer({ name: "4train_couch_endpoints" });
    endpoints.use(restify.bodyarser({ mapParams: false }));
	endpoints.listen(4187);

    // default options for all endpoint requests
    var options = {
        host: config.database.host,
        port: config.database.port,
        auth: config.database.auth,
        headers: { "Content-Type": "application/json" }
    };

    // default handler for database requests
    var couch_request = function(req, res, opts) {
        var db_req = http.request(opts, function(db_res) {
            // construct database response and send to client
            var json_res = "";
            db_res.setEncoding("utf8");
            db_res.on("data", function(chunk) {
                json_res += chunk;
            });
            db_res.on("end", function() {
                res.contentLength = json_res.length;
                res.contentType = "application/json";
                res.send(200, json_res);
            });
        }).on("error", function(e) {
            // send client a generic Internal Server Error
            console.log("Error finishing request: " + JSON.stringify(e));
            res.send(500, JSON.stringify(e));
        });

        // pipe req received to db
        db_req.write(JSON.stringify(req.body));
        db_req.end();
    };

	// POST /:database - CREATE document
	endpoints.post("/:database", function(req, res, next) {
        if(!req.is("application/json"))
            return next(new restify.InvalidContentError("request needs to have Content-Type of 'application/json'"));

        var opts = _.chain(options).clone()
            .extend({ method: "POST", path: "/" + req.params.database })
            .value();
        couch_request(req, res, opts);

        return next();
	});

	// GET /:database/:id - READ document
	endpoints.get("/:database/:id", function(req, res, next) {
        if(!req.is("application/json"))
            return next(new restify.InvalidContentError("request needs to have Content-Type of 'application/json'"));

        var opts = _.chain(options).clone()
            .extend({ method: "GET", path: "/" + req.params.database + "/" + req.params.id })
            .value();
        couch_request(req, res, opts);

        return next();
	});

	// PUT /:database/:id - UPDATE document
	endpoints.put("/:database/:id", function(req, res, next) {
        if(!req.is("application/json"))
            return next(new restify.InvalidContentError("request needs to have Content-Type of 'application/json'"));

        var opts = _.chain(options).clone()
            .extend({ method: "PUT", path: "/" + req.params.database + "/" + req.params.id })
            .value();
        couch_request(req, res, opts);

        return next();
	});

	// DEL /:database/:id - DELETE document
	endpoints.del("/:database/:id", function(req, res, next) {
        if(!req.is("application/json"))
            return next(new restify.InvalidContentError("request needs to have Content-Type of 'application/json'"));

        var opts = _.chain(options).clone()
            .extend({ method: "DEL", path: "/" + req.params.database + "/" + req.params.id })
            .value();
        couch_request(req, res, opts);

        return next();
	});

    return endpoints;
})();