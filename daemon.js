
const fs = require("fs");

const ipc = require('node-ipc');

const splunk_emit = require("./index.js");


function fileLogger(msg){
    
    //todo: check for size limit and rotate
    fs.appendFileSync(this.path, msg );

}

async function run(id, splunkUrl,splunkHEC, args){

    const splunk_emit = require("./index.js");

    const transform_eventBatch = new splunk_emit.EventBatch({
        debug : args.debug
    });
    const nonTransform_eventBatch = new splunk_emit.EventBatch({
        debug : args.debug,
        _event_transform : false
    });
    const emitter = new splunk_emit.HEC_Emitter({
        splunk_url : splunkUrl,
        splunk_hec : splunkHEC,
        debug : args.debug
    });

    transform_eventBatch.enableAutoFlush( emitter, args.flush_timeout || 10 );
    nonTransform_eventBatch.enableAutoFlush( emitter, args.flush_timeout || 10 );


    if( !args.console ){
        require('daemon')({
            cwd : process.cwd()
        });
        // after this point, we are a daemon
    }

    ipc.config.id   = id;
    ipc.config.retry= 1500;

    if( !args.console && !args.log_file ){
        ipc.config.logger= fileLogger.bind({ path : args.log_file });
    }

    ipc.serve(
        function(){
            ipc.server.on(
                'message',
                async function(data,socket){
                    ipc.log('got a message : ', JSON.stringify(data));

                    if( data.opts && data.opts.raw){
                        await nonTransform_eventBatch.add(data.msg);
                    }
                    else{
                        await transform_eventBatch.add(data.msg);
                    }

                    if( data.opts && data.opts.ack){
                        ipc.server.emit(
                            socket,
                            'ack',  
                            'ack'
                        );
                    }
                }
            );
            ipc.server.on(
                'socket.disconnected',
                function(socket, destroyedSocketID) {
                    ipc.log('client ' + destroyedSocketID + ' has disconnected!');
                }
            );
        }
    );
 
    ipc.server.start();

}

module.exports = run;