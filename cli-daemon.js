const argv = require('yargs').argv;
const hash = require('hash.js');

// --splunk_url (splunk HEC url) --splunk_hec (splunk HEC id)
//--flush_timeout (secs splunk-emit batch flushes) --debug (debug loggind)
//--console (dont run as a daemon) --log_file (if --console is not present; file to log debug info)


const splunk_daemon = require("./daemon.js");

//todo: validate required args/env vars (splunk_url,splunk_hec);


let splunk_url = argv.splunk_url || process.env.SPLUNK_URL;
let splunk_hec  = argv.splunk_hec || process.env.SPLUNK_HEC;

let hash_id = hash.sha1().update(`${splunk_url}#${splunk_hec}`).digest('hex');


splunk_daemon(hash_id, splunk_url, splunk_hec, argv );
