'use strict';

/**
 * @author Scott Williams
 * This server script is run when a post request from the client is made to 
 * the "/getAllItems" URL. This will then connect two 2 different databases
 * and return all 'item' information from both of them.
 * 
 *                              Usage
 * 
 *      // Server
 * 
 *      // Add this to your app routes
 *      let mongoDb = require('./routes/mongoDb');
 *      app.use('/mongoDb', mongoDb);
 * 
 *      // Client
 * 
 *      // Define funtion to access the server
 *      function callServer(route) {
 *          // Synchronous client code that can call the server using the passed end point.
 *          let data;
 *
 *          $.ajax({
 *              type: 'POST',
 *              url: route,
 *              data: data,
 *              async: false
 *          }).done(function (res) {
 *              data = res;
 *          });
 *
 *          return data;
 *      }
 * 
 *      // Fetch the results from the server
 *      let result = callServer('/mongoDb/getAllItems');
 */


/** Imports */
let express = require('express');
let Fiber = require('fibers');
let Future = require('fibers/future');
let Mongoose = require('mongoose').Mongoose;

let router = express.Router();


/** First mongoDb connection URL */
const MONGO_URL_1 = "";


/** Second mongoDb connection URL */
const MONGO_URL_2 = "";


/** Server code that gets all items from both mongo databases */
router.post("/getAllItems", function (req, res) {
    let firstDbItems = [];
    let secondDbItems = [];


    /**
     * @function getItems
     * Given the DB string, connect and fetch all of the items in the collection
     * 
     * @param {String} MONGO_URL : URL string for connecting to mongo
     * 
     * @returns {Array} of Objects like such: {
     *      itemId: String,
     *      itemName: String
     * } */
    function getItems(MONGO_URL) {
        // Wrap this in a future since the DB call and get are async
        const future = new Future();

        // Set up the connection to the DB
        let mongoose = new Mongoose();

        // Attempt to connect to the DB
        mongoose.connect(MONGO_URL);
        console.log("Connecting to Mongo :", MONGO_URL);


        /** Check if the connection to mongoDb was successful */
        mongoose.connection.on('error', function (errorMessage) {
            process.exitCode = 1;
            console.error("Connection error: ", errorMessage);
            throw new Error("Cannot connect to mongo!", errorMessage);
        });


        /**
         * @function find
         * Code from S.O. that works great for accessing a mongo collection
         * using a mongoose object in the closure
         * 
         * @param {String} collec : Collection name like 'sensors'
         * @param {Object} query : Query JSON like { _id: 10 }
         * @param {function} callback : Function to call when we finish
         */
        function find(collec, query, callback) {
            mongoose.connection.db.collection(collec, function (err, collection) {
                collection.find(query).toArray(callback);
            });
        }


        /** Runs when connection is successful */
        mongoose.connection.once('open', function () {
            console.log("Connection to MongoDB Succesfull!");
            // Connected to mongo if this fires, so may as well try
            // doing the magic here...
            find('items', {}, (error, result) => {
                let items = [];
                if (error) {
                    console.log("Error: ", error);
                } else if (!result) {
                    console.log("No items retrieved from DB");
                } else {
                    // Grab all the ids and names from the items in the DB
                    items = result.map(function (item) {
                        return {
                            itemId: item._id,
                            itemName: item.name
                        };
                    });
                }

                // We can disconnect since we have what we need
                mongoose.disconnect();
                future.return({ error, items });
            });
        });

        // Don't return until we have the results needed
        return future.wait();
    }

    /**
     * Main entry point of "/getAllItems". Using a fiber here and futures
     * in getItems allows us to do two synchronest calls to mongoDb, then
     * combine the results. */
    Fiber(function () {
        // Get all items from the first DB
        let result = getItems(MONGO_URL_1);
        firstDbItems = result.items;

        // Get all items from the second DB
        result = getItems(MONGO_URL_2);
        secondDbItems = result.items;

        // Combine the two arrays and return all of the items
        let totalItems = firstDbItems.concat(secondDbItems);

        // Return the results to the client
        res.send(totalItems);
    }).run();
});


module.exports = router;