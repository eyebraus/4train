
var auth = require('./config.auth');

var envs = {
    development: {
        database: {
            host: auth.development.database.host,
            port: 5984,
            name: "development",
            auth: auth.development.database.auth
        },
        lastfm: {
            api_key: auth.development.lastfm.api_key
        },
        user_agent: auth.development.user_agent
    },

    production: {
        database: {
            host: auth.production.database.host,
            port: 5984,
            name: "production",
            auth: auth.production.database.auth
        },
        lastfm: {
            api_key: auth.production.lastfm.api_key
        },
        user_agent: auth.production.user_agent
    },

    test: {
        database: {
            host: auth.production.database.host,
            port: 5984,
            name: "test",
            auth: auth.production.database.auth
        },
        lastfm: {
            api_key: auth.production.lastfm.api_key
        },
        user_agent: auth.production.user_agent
    }
}

module.exports = (function() {
    var env = envs[process.env.NODE_ENV];
    env.database.url = function() {
        var db = env.database;
        return "http://" + db.auth + "@" + db.host + ":" + db.port + "/";
    };
    return env;
})();