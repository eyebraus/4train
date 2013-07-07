
// TODO: make auth.js available on heroku-specific branch, but not on master
exports.development = {
    database: {
        host: "http://localhost"
    },
    user_agent: "Rapgraff/0.0.1 (whalesonstilts2012@gmail.com)"
};

exports.production = {
    database: {
        host: "http://app16677877.heroku.cloudant.com"
    },
    user_agent: "Rapgraff/0.0.1 (whalesonstilts2012@gmail.com)"
};