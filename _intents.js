
var request = require('requestretry');
const stringifyObject = require('stringify-object');
const chalk = require('chalk');

// time delay between requests
const delayMS = 1000;

// retry recount
const maxRetry = 5;

// retry request if error or 429 received
var retryStrategy = function (err, response, body) {
    let shouldRetry = err || (response.statusCode === 429);
    if (shouldRetry) console.log("retrying add intent...");
    return shouldRetry;
}

// Call add-intents
var addIntents = async (config) => {
    var intentPromises = [];
    config.uri = config.uri.replace("{appId}", config.LUIS_appId).replace("{versionId}", config.LUIS_versionId);

    config.intentList.forEach(function (intent) {
        config.intentName = intent;
        try {

            // JSON for the request body
            var jsonBody = {
                "name": config.intentName,
            };

            // Create an intent
            var addIntentPromise = callAddIntent({
                // uri: config.uri,
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
            intentPromises.push(addIntentPromise);

            console.log(`Called addIntents for intent named ${chalk.bold(intent)}.`);

        } catch (err) {
            console.error(chalk.red(`Error in addIntents:  ${err.message} `));

        }
    }, this);

    let results = await Promise.all(intentPromises);
    console.log(`Intents added ${chalk.bold(results.length)}`);
    let response = results;


}

// Send JSON as the body of the POST request to the API
var callAddIntent = async (options) => {
    try {

        var response;        
        response = await request(options);
        return { response: response };

    } catch (err) {
        console.error(`Error in callAddIntent:  ${err.message} `);
    }
}

module.exports = addIntents;