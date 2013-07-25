
var auth = require('./config.auth');

var envs = { 
    development: {
        database: {
            host: auth.development.database.host,
            port: 5984,
            name: "rapgraff"
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
            name: "rapgraff"
        },
        lastfm: {
            api_key: auth.production.lastfm.api_key
        },
        user_agent: auth.production.user_agent
    }
};

exports = (function() {
    return envs[process.env.NODE_ENV];
})();