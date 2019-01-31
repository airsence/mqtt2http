require('dotenv').config({
  silent: true
});

const mqtt = require('mqtt');
const request = require('request');
const Handlebars = require('handlebars');
const express = require('express');
Handlebars.registerHelper('stringify', object => {
  return new Handlebars.SafeString(JSON.stringify(object));
});

const IS_JSON = /^\{|\[/;

const DEBUG_LOG = !!process.env.DEBUG_LOG;
const DEBUG_PUBLISH = parseInt(process.env.DEBUG_PUBLISH, 10);
const DEBUG_MESSAGE = process.env.DEBUG_MESSAGE;
const DEBUG_NOOP = !!process.env.DEBUG_NOOP;

const MQTT_URL = process.env.MQTT_URL;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_CONNECT = process.env.MQTT_CONNECT ? JSON.parse(process.env.MQTT_CONNECT) : {};
const MQTT_TOPIC = IS_JSON.test(process.env.MQTT_TOPIC) ? JSON.parse(process.env.MQTT_TOPIC) : process.env.MQTT_TOPIC;
const MQTT_SUBSCRIBE = process.env.MQTT_SUBSCRIBE ? JSON.parse(process.env.MQTT_SUBSCRIBE) : undefined;

const HTTP_URL = process.env.HTTP_URL ? Handlebars.compile(process.env.HTTP_URL) : undefined;
const HTTP_JSON = !!process.env.HTTP_JSON;
const HTTP_REQUEST = process.env.HTTP_REQUEST ? Handlebars.compile(process.env.HTTP_REQUEST) : undefined;

if (MQTT_USERNAME) {
  MQTT_CONNECT.username = MQTT_USERNAME;
}

if (MQTT_PASSWORD) {
  MQTT_CONNECT.password = MQTT_PASSWORD;
}
let app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Our app is running on port ${ PORT }`);
});
let client = MQTT_URL ? mqtt.connect(MQTT_URL, MQTT_CONNECT) : mqtt.connect(MQTT_CONNECT);
let retained = true;
client.on('connect', connack => {
  debug('connect', connack);

  client.subscribe(MQTT_TOPIC, MQTT_SUBSCRIBE, (err, granted) => {
    debug('subscribe', err, granted);
  });
});

client.on('error', debug.bind(null, 'error'));

client.on('message', (topic, message, packet) => {
  debug('message', topic, message.toString(), packet);

  let messageString = message.toString();
  let messageObject = IS_JSON.test(messageString) ? JSON.parse(messageString) : undefined;

  //debug('messageObject',messageObject)
  // let options = HTTP_REQUEST ? JSON.parse(HTTP_REQUEST({
  //   topic: topic,
  //   message: messageObject || messageString
  // })) : {};
  let options = {};
  if(HTTP_URL){
    options.uri = HTTP_URL;
  }
  if(topic == 'airsence/wills/server'){
    if(retained){
      retained = false;
    }
    else{
      options.json = true;
      options.body = {
        value1:topic,
        value2:"AirSENCE Server Computer is Down",
        value3:messageString
      };
      if (HTTP_URL) {
        options.uri = HTTP_URL;
      }
      debug('request', options);
  
      if (!DEBUG_NOOP) {
        request(options, (error, response, body) => debug.bind(null, 'response'));
      }
    }

  }
  if(topic == 'airsence/server/status'){
    let apache_status = messageObject ? messageObject.A : parseInt(messageString[messageString.length - 8]);
    let mysql_status = messageObject ? messageObject.M : parseInt(messageString[messageString.length - 2]);
    if(!(apache_status && mysql_status) && messageString){
      options.json = true;
      options.body = {
        value1:topic,
        value2:"AirSENCE Server Service is Down",
        value3:messageString
      };
      if (HTTP_URL) {
        options.uri = HTTP_URL;
      }
      debug('request', options);

      if (!DEBUG_NOOP) {
        request(options, (error, response, body) => debug.bind(null, 'response'));
      }
    }

  }


  // if (messageObject && HTTP_JSON) {
  //   options.json = true;
  //   options.body = {
  //     topic: topic,
  //     message: messageObject
  //   };
  // }

  // if (HTTP_URL) {
  //   options.uri = HTTP_URL({
  //     topic: topic,
  //     message: messageObject || messageString
  //   });
  // }


});

if (DEBUG_PUBLISH > 0) {
  setInterval(() => {
    client.publish(MQTT_TOPIC, DEBUG_MESSAGE || JSON.stringify({
      time: (new Date()).toString()
    }));
  }, DEBUG_PUBLISH);
}

function debug(...args) {
  if (!DEBUG_LOG) {
    return;
  }
  args.unshift('[DEBUG]');
  console.log.apply(null, args);
}
