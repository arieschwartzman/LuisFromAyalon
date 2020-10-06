// node 7.x
// built with streams for larger files

const fse = require('fs-extra');
const lineReader = require('line-reader');
const Promise = require('bluebird');
const request = require('requestretry');


var retryStrategy = function (err, response, body) {
    let shouldRetry = err || (response.statusCode === 429);
    if (shouldRetry) console.log("retrying add entity...");
    return shouldRetry;
}

var eachLine = Promise.promisify(lineReader.eachLine);

function listOfIntents(intents) {
    return intents.reduce(function (a, d) {
        if (a.indexOf(d.intentName) === -1) {
            a.push(d.intentName);
        }
        return a;
    }, []);

}

function listOfEntities(utterances) {
    return utterances.reduce(function (a, d) {        
        d.entityLabels.forEach(function(entityLabel) {
            if (a.indexOf(entityLabel.entityName) === -1) {
                a.push(entityLabel.entityName);
            }     
        }, this);
        return a;
    }, []);
}

const convert = async (config, configAyalon) => {

    try {

        var i = 0;

        // get inFile stream
        inFileStream = await fse.createReadStream(config.inFile, 'utf-8')

        // create out file
        var myOutFile = await fse.createWriteStream(config.outFile, 'utf-8');
        var utterances = [];
        var documents = {};
        var ayalonPromises = [];
        var id = 0;
        // read 1 line at a time
        return eachLine(inFileStream, async (line) => {

            var docId = "" + id++;
            var document = 
                {
                    language: 'en',
                    id: docId,
                    text: line
                }
            
            var jsonBody = {
                documents: [document]
            }

            documents[docId] = document;

            // csv to baby parser object
            var ayalonOptions = {
                // uri: config.uri,
                url: configAyalon.uri,
                fullResponse: false,
                method: 'POST',
                json: true,
                body: jsonBody,
                maxAttempts: 5,
                retryDelay: 1000,
                retryStrategy: retryStrategy
            };
            ayalonPromises.push(request(ayalonOptions));

        }).then(async () => {
            var ayalonResponses = await Promise.all(ayalonPromises);
            for (r of ayalonResponses) {
                if (r.errors.length == 0 && r.documents.length > 0 && r.documents[0].entities.length > 0) {
                    var entityLabels = [];
                    for(entity of r.documents[0].entities) {
                        entityLabels.push({
                            entityName: entity.category,
                            startCharIndex: entity.offset,
                            endCharIndex: entity.offset + entity.length
                        })
                    }
                    var utterance = {
                        text: documents[r.documents[0].id].text,
                        intentName: 'ayalon',
                        entityLabels
                    }
                    utterances.push(utterance);                
                }
            }
            console.log("intents: " + JSON.stringify(listOfIntents(utterances)));
            console.log("entities: " + JSON.stringify(listOfEntities(utterances)));
            myOutFile.write(JSON.stringify({ "converted_date": new Date().toLocaleString(), "utterances": utterances }));
            myOutFile.end();
            console.log("parse done");
            console.log("JSON file should contain utterances. Next step is to create an app with the intents and entities it found.");

            var model = 
            {
                intents: listOfIntents(utterances),
                entities: listOfEntities(utterances)                
            }
            return model;

        });

    } catch (err) {
        throw err;
    }

}

module.exports = convert;