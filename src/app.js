'use strict';
const app = require ('express') ();

module.exports = function createApp (db) {
    app.get ('/hit', (req, res) => {
        let collection = db.collection ('hitcollection');
        collection.findOne ({name:'hit'})
            .then ((doc) => {
               if (doc) {
                   collection.updateOne ({name:'hit'},{$set: {count: doc.count + 1}})
                    .then ((docUpdate) => {
                        res.status (200).send (`Hit ${doc.count+1}`);
                    })
                    .catch ((error) => {
                        res.status (500).send ('Server error');
                    });
               } else {
                   collection.insertOne ({name:'hit', count: 1})
                    .then ((docCreated) => {
                        res.status (201).send ('Hit 1');
                    })
                    .catch ((error) => {
                        res.status (500).send ('Server error');
                    });
               }
            })
            .catch ((error) => {
                res.status (500).send ('Server error');
            });
    });
    return app;
}
