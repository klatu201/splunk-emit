
const sleep = require('await-sleep');
const uuidv4 = require('uuid/v4');

const event_generator = require("./event-generator.js");

const eventGen = new event_generator.EventGen();

const splunk_emit = require("../index.js");

const emitter = new splunk_emit.HEC_Emitter({
    debug : true
});




async function _autoFlushTest() {
    let eventBatch = new splunk_emit.EventBatch({
        debug : true
    });

    let test_id = uuidv4();
    console.log( `Autoflush test_id -> ${test_id}`);
    eventBatch.enableAutoFlush( emitter );   

    emitter.on( 'flush', () => {
        console.log("emitter.flushed");
    });

    for( let i = 0; i < 32; i++){
        //console.time("add_event");
        await eventBatch.add( `${eventGen.another()}\n{ "tags" : ["splunk-emit", "test", "${test_id}"], "msg" : "${eventGen.another()}" }` ); 
        //console.timeEnd("add_event");
        await sleep(1000);
    }
    


    emitter.sendBatch(eventBatch);
    eventBatch.reset();

}

async function _nonJsonTest() {
    let eventBatch = new splunk_emit.EventBatch({
        debug : true
    });

    let test_id = uuidv4();
    console.log( `NonJsonTest test_id -> ${test_id}`);


    for( let i = 0; i < 10; i++){
        await eventBatch.add( `${test_id} : ${eventGen.another()}`); 
    }

    console.log( `batch size - ${eventBatch.getSize()}` );
    await emitter.sendBatch( eventBatch );
    console.log( `batch size - ${eventBatch.getSize()}` );

}

async function _rawEventTest() {
    let eventBatch = new splunk_emit.EventBatch({
        debug : true,
        event_transform : false
    });

    let test_id = uuidv4();
    console.log( `NonJsonTest test_id -> ${test_id}`);
 

    for( let i = 0; i < 10; i++){
        await eventBatch.add( `${test_id} : ${eventGen.another()}`); 
    }

    console.log( `batch size - ${eventBatch.getSize()}` );
    await emitter.sendBatch( eventBatch );
    console.log( `batch size - ${eventBatch.getSize()}` );

}





//_rawEventTest();

_autoFlushTest();

//_nonJsonTest();

