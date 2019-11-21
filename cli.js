const argv = require('yargs').argv;
const hash = require('hash.js');
const ipc= require('node-ipc');

// --splunk_url (splunk HEC url) --splunk_hec (splunk HEC id)
// --msg (the messgae to emit) --ack (require ack from ipcSend)
// --raw (dont transform message) --nodaemon (just send via splunk-emit) --debug (write debug text to console)



let splunk_url = argv.splunk_url || process.env.SPLUNK_URL;
let splunk_hec  = argv.splunk_hec || process.env.SPLUNK_HEC;

//todo: validate required args (msg) /env vars (splunk_url,splunk_hec);

let hash_id = hash.sha1().update(`${splunk_url}#${splunk_hec}`).digest('hex');

function ipcSend(hashId, msg){

    ipc.config.id   = hashId;
    ipc.config.retry= 1500;

    if( !argv.debug ){
        ipc.config.logger = function(logMsg){

        };
    }
 
    return new Promise( (resolve,reject) => {
        ipc.connectTo(
            hash_id,
            function(){
                ipc.of[hashId].on(
                    'connect',
                    function(){
                        ipc.log('## connected to world ##'.rainbow, ipc.config.delay);
                        ipc.of[hashId].emit(
                            'message',  //any event or message type your server listens for
                            {
                                opts : {
                                    raw : argv.raw
                                },
                                msg : msg
                            }
                        );
                        //todo: finish ack pattern
                        ipc.disconnect(hashId);
                        resolve();
                    }
                );
                ipc.of[hashId].on(
                    'disconnect',
                    function(){
                        ipc.log('disconnected from world'.notice);
                    }
                );
                ipc.of[hashId].on(
                    'message',  //any event or message type your server listens for
                    function(data){
                        ipc.log('got a message from world : '.debug, data);
                    }
                );
                ipc.of[hashId].on(
                    'error',
                    function(e) {
                        ipc.disconnect(hashId);
                        reject(e);
                    }
                );
            }
        );
    });

}

function send(msg){

    const splunk_emit = require("./index.js");

    const eventBatch = new splunk_emit.EventBatch({
        debug : argv.debug
    });
    const emitter = new splunk_emit.HEC_Emitter({
        splunk_url : splunk_url,
        splunk_hec : splunk_hec,
        debug : argv.debug
    });

    return eventBatch.add(msg).then( async () => {
        await emitter.sendBatch(eventBatch);
    } );

}

//try to parse msg into JSON
let msg = argv.msg;
try{
    msg = JSON.parse(msg);
}
catch(e){
    let s = e;
}


if( argv.raw ){
    send(msg).then( () => {
        return;
    });
}
else{
    ipcSend( hash_id, msg ).then( () => {
        return;
    }).catch( (e) => {
        //fallback, just send via splunk-emit
        send(msg).then( () => {
            return;
        });
    });
}

