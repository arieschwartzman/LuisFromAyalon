// node 7.x
// uses async/await - promises

const request = require("requestretry");
const stringifyObject = require('stringify-object');
const chalk = require('chalk');


// time delay between requests
const delayMS = 1000;

// retry recount
const maxRetry = 5;

// retry request if error or 429 received
var retryStrategy = function (err, response, body) {
    let shouldRetry = err || (response.statusCode === 429);
    if (shouldRetry) console.log("retrying add entity...");
    return shouldRetry;
}

// main function to call
// Call add-entities
var addEntities = async (config) => {
    var entityPromises = [];
    config.uri = config.uri.replace("{appId}", config.LUIS_appId).replace("{versionId}", config.LUIS_versionId);

    config.entityList.forEach(function (entity) {
        try {
            config.entityName = entity;
            // JSON for the request body
            // { "name": MyEntityName}
            var jsonBody = {
                "name": config.entityName,
            };

            // Create an app
            var addEntityPromise = callAddEntity({
                url: config.uri,
                fullResponse: false,
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': config.LUIS_subscriptionKey
                },
                json: true,
                body: jsonBody,
                maxAttempts: maxRetry,
                retryDelay: delayMS,
                retryStrategy: retryStrategy
            });
            entityPromises.push(addEntityPromise);

            console.log(`called addEntity for entity named ${chalk.bold(entity)}.`);

        } catch (err) {
            console.error(chalk.red(`Error in addEntities:  ${err.message} `));
        }
    }, this);
    let results = await Promise.all(entityPromises);
    console.log(`Results of all promises = ${stringifyObject(results, {indent:'   '})}`);
    let response = results;// await fse.writeJson(createResults.json, results);
}

// Send JSON as the body of the POST request to the API
var callAddEntity = async (options) => {
    try {

        var response;        
        response = await request(options);
        return { response: response };

    } catch (err) {
        console.error(chalk.red(`error in callAddEntity: ${err.message}`));
    }
}

module.exports = addEntities;