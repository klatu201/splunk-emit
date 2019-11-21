
# Splunk Emit

JavaScript library to emit JSON "events" to splunk via a HEC  
Includes native (win|mac|linux) cli

-------
### Support

- Node 

-------
### Setup

```npm install splunk-emit```


### ES5 Example

```javascript



const splunk_emit = require("splunk-emit");

const emitter = new splunk_emit.HEC_Emitter({
    debug : true,
    splunk_url : "{{target-SPLUNK_URL}}", //OR set environment var SPLUNK_URL
    splunk_hec : "{{target-SPLUNK_HEC}}" //OR set environment var SPLUNK_HEC
});

 let eventBatch = new splunk_emit.EventBatch({
        debug : true
    });
eventBatch.enableAutoFlush(emitter, 1); //1 sec flush

eventBatch.add( {
    name : "value",
    index : 1,
    text : "this ia an example"
} );

emitter.on( 'flush', () => {
    process.exit();
});
```

-------
### API


-------
### Cli