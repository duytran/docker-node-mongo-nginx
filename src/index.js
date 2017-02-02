'use strict';
const app = require ('./app');
const mongodb = require ('mongodb');
let MongoClient = mongodb.MongoClient;

const mongo_host = 'mongo'; //process.env.MONGO_HOST | 'localhost';

const mongoUrl = 'mongodb://hitdbadmin:hitdbadmin@' + mongo_host + ':27017/hitdb';
const port = process.env.PORT || process.argv[2] || 3000;

MongoClient.connect (mongoUrl, (error, db) => {
    if (error) return console.error ('Cannot connect to MongoDB. Error', error);
    console.log ('Connect to MongoDB successful!');
    app(db).listen (port, () => console.log ('Application listen at ' + port));
});
