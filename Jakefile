
var spawn = require('child_process').spawn,
    vargs = require('vargs').Constructor,
    _ = require('underscore')._;

desc('Executes the metadata collection script.');
task('metadata', [], function() {
    // detect environment
    if(_.has(process.env, "env")) {
        if(process.env.env == "p" || process.env.env == "prod" || process.env.env == "production")
            process.env.NODE_ENV = "production";
        else if(process.env.env == "d" || process.env.env == "dev" || process.env.env == "development")
            process.env.NODE_ENV = "development";
        else if(process.env.env == "t" || process.env.env == "test")
            process.env.NODE_ENV = "test";
        else {
            console.log("Unrecognized configuration: jake metadata env:" + process.env.env);
            process.exit(1);
        }
    }
    // run the script as a child process
    var procs = ["node ./metadata.js"];
    jake.exec(procs, { printStdout: true, printStderr: true }, function() {
        console.log("Finished running '" + JSON.stringify(procs) + "'");
        complete();
    })
});