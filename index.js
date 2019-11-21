const fs = require('fs');
const util = require('util');
const setImmediatePromise = util.promisify(setImmediate);
const EventEmitter = require('events'); 

const tempfile = require('tempfile');
const moment = require('moment');
const uuidv4 = require('uuid/v4');
const request = require('request');

let json_regex = /([\s\S]*)?(\{[^]+\})([\s\S]*)?/gmi;

class EventBatch{

    constructor(opts){
       opts = opts || {};

       this._temp_file = tempfile();
       this._max_size = opts.max_size || 50;
       this._current_size = 0;
       this._event_transform = opts.event_transform !== undefined ? opts.event_transform  :  true;
       this._auto_flush = null;
       this._debug = opts.debug || process.env.DEBUG;

    }

    add(evt) {

        return new Promise ( (resolve,reject) => {
            let _ = null;

            if( this._event_transform  ){
                evt = transformEvent(evt);
            }
            else {
                evt = {
                    time : Math.floor(new Date()),
                    event : evt
                };
            }

            fs.appendFileSync(this._temp_file, JSON.stringify(evt));
            this._current_size++;

            let batch_full = !(this._current_size  < this._max_size);
            if( batch_full && this._auto_flush ){
                clearInterval( this._auto_flush.interval);
                return setImmediatePromise(this._auto_flush.func).then( () => {
                    this._auto_flush.interval = setInterval( this._auto_flush.func , 10000);
                    return true;
                });
            }
            else{
                resolve(batch_full);
            }
           
        });


    }

    getSize() {
        return this._current_size;
    }

    reset(){
        if( fs.existsSync( this._temp_file )){
            fs.unlinkSync( this._temp_file);
        }
        this._temp_file = tempfile();
        this._current_size = 0;
    }

    forceFlush(){
        if( this._auto_flush ){
            clearInterval( this._auto_flush.interval);
            return setImmediatePromise(this._auto_flush.func).then( () => {
                this._auto_flush.interval = setInterval( this._auto_flush.func , 10000);
                return true;
            });
        }
        else{
            return Promise.reject("auto-flush is not enabled");
        }
    }

    readStream() {
        return fs.createReadStream( this._temp_file );
    }

    dispose() {
        if( fs.existsSync( this._temp_file )){
            fs.unlinkSync( this._temp_file);
        }
    }

    
    enableAutoFlush( emitter, flushTimeout = 10) {
        if( ! this._auto_flush ) {

            this._auto_flush = {
                func : flush.bind({ emitter : emitter, batch : this} ),
                interval : null
            };

            this._auto_flush.interval =  setInterval( this._auto_flush.func , 10000);
        }
    }

}

async function flush() {
    if( this.batch._current_size > 0 ){
        console.log( `autoflush - ${this.batch._current_size}`);
        await this.emitter.sendBatch(this.batch);
    }
}

 function transformEvent(evt) {
    let _ = null;
    if (!isObject(evt)){
                

        //json plucking magic
        let matches = json_regex.exec(evt);
        if(!matches){
            //no regex matches; its just text
            _ = {};
            _.text = evt;
            
        }
        else{
        
            if( matches[2] ){
                //there might be a buired JSON obj
                try{
                    let obj = JSON.parse(matches[2]);
                    if( isObject(obj)){
                        _ = obj;
                    }
                }
                catch(e){
                    let s = e;
                }

                if (!_){
                    //its just text
                    _ = {};
                    _.text = matches[2];
                }

            }
        }
        
        if( !_.text && matches[1]){ 
            _.text_pre = matches[1]; //text before buired json
        }

        if( !_.text && matches[3]){
            _.text_post = matches[3];  //text after buired json
        }

        evt = {};
        evt.event = _;
    }
    else{
    
        if ( !evt.event){
            _ = {};
            _.event = evt;
            evt = _;
        }
    }

    if( evt.event && evt.event._ts ){ //pull ISO timestamp(_ts) from event
        evt.time = Math.floor( moment(evt.event._ts).valueOf() ); /// 1000 );
    }
    else if( !evt.time){
        evt.time = Math.floor(new Date());// / 1000);
    }

    evt.meta = Object.keys(process.env).reduce( (t,v,i) =>{
        if( v.startsWith("SPLUNK-META-")){
            t[v.substring(3)] = process.env[v];
        }
        return t;
    }, {});
    if( Object.keys(evt.meta).length === 0 ){
        delete evt.meta; 
    }

    return evt;
}
module.exports.transformSplunkEvent = transformEvent;

function isObject (a) {
    return (!!a) && (a.constructor === Object);
}

class HEC_Emitter extends EventEmitter {

    constructor(opts){
        super();

        opts = opts || {};
        this._splunk_url = opts.splunk_url || process.env.SPLUNK_URL;
        this._splunk_hec = opts.splunk_hec || process.env.SPLUNK_HEC;
        this._debug = opts.debug || process.env.DEBUG;
    }

    sendBatch(eventBatch){
       //check for type of eventBatch

        if( !eventBatch.getSize()){
            return Promise.resolve(); //it was an empty batch
        }
        
        let me = this;
        return new Promise ( (resolve,reject) => {

            
            let req = request.post( {
                url : `${this._splunk_url}?channel=${uuidv4()}`,
                headers : {
                    "Authorization" : `Splunk ${this._splunk_hec}`
                }
            });
            eventBatch.readStream().pipe(req);
            req.on('data', (d) => {
                if( this._debug){
                    console.log(d.toString());
                }
              })
              .on('close', () => {
                    eventBatch.reset();
                    me.emit('flush', me);
                    resolve();
              })
              .on('error', error => reject(error));

        });
    
 
      
    }

}

module.exports = {
    EventBatch : EventBatch,
    HEC_Emitter : HEC_Emitter
};