// node 7.x
// built with streams for larger files

const fse = require('fs-extra');
const lineReader = require('line-reader');
const Promise = require('bluebird');
const request = require('requestretry');
const chalk = require('chalk');
const stringifyObject = require('stringify-object');
var rp = require('request-promise');

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
                url: configAyalon.uri,
                headers: {
                    'x-ctm-api-key': configAyalon.key
                },
                fullResponse: false,
                method: 'POST',
                json: true,
                body: jsonBody
            };
            ayalonPromises.push(rp(ayalonOptions));

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
            console.log(chalk.bold("intents: ") + stringifyObject(listOfIntents(utterances), {
                indent: '  '
            }));
            console.log(chalk.bold("entities: ") + stringifyObject(listOfEntities(utterances), {
                indent: '  '
            }));

            console.log(`Got ${chalk.bold(ayalonResponses.length)} Ayalon responses`);

            myOutFile.write(JSON.stringify({ "converted_date": new Date().toLocaleString(), "utterances": utterances }));
            myOutFile.end();
            console.log(chalk.bold("Parse done"));

            var model = 
            {
                intents: listOfIntents(utterances),
                entities: listOfEntities(utterances)                
            }
            return model;

        }).catch(function(err) {
            console.error(chalk.red(err.message));
        }); 

    } catch (err) {
        throw err;
    }

}

module.exports = convert;