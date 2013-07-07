
var auth = require('./auth');

var envs = { 
    development: {
        database: {
            host: auth.development.host,
            port: 5984,
            name: "rapgraff"
        },
        user_agent: auth.development.user_agent
    },

    production: {
        database: {
            host: auth.production.host,
            port: 5984,
            name: "rapgraff"
        },
        user_agent: auth.production.user_agent
    }
};

exports = (function() {
    return envs[process.env.NODE_ENV];
})();