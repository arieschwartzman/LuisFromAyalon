#!/usr/bin/env node
const path = require('path');
const chalk = require('chalk');
const parse = require('./_parse');
const createApp = require('./_create');
const addEntities = require('./_entities');
const addIntents = require('./_intents');
const upload = require('./_upload');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const fs = require('fs');

// Change these values
const LUIS_appCulture = "en-us"; 
const LUIS_versionId = "0.1";

// NOTE: final output of add-utterances api named utterances.upload.json
const uploadFile = "./utterances.json"

// The app ID is returned from LUIS when your app is created
var LUIS_appId = ""; // default app ID
var intents = [];
var entities = [];

class FileDetails {
    constructor (filename) {
      this.filename = filename
      this.exists = fs.existsSync(filename)
    }
}

const optionDefinitions = [
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        description: 'Display this usage guide.'
    },
    {
        name: 'luisApp',
        alias: 'a',
        type: String,
        description: 'LUIS application name',        
        typeLabel: '<appname>'
    }, 
    {
        name: 'luisAuthoringKey',
        alias: 'k',
        type: String,
        description: 'LUIS Authoring Key',
        typeLabel: '<authkey>'
    },
    {
        name: 'examplesFile',
        alias: 'f',
        type: String,
        type: filename => new FileDetails(filename),
        description: 'Examples file path',
        typeLabel:'<file path>'
    },
    {
        name: 'uploadFile',
        alias: 'u',
        type: String,
        description: 'Utterances upload JSON file - (default: utterances.json)',
        defaultValue: 'utterances.json',
        typeLabel: '<file path>'
    },
    {
        name: 'ayalonHostName',
        alias: 'n',
        type: String,        
        description: 'Ayalon service URI used to parse utterances (default: https://ctm-covid19-gateway-webapp.azurewebsites.net/ta4h/',
        defaultValue: 'https://ctm-covid19-gateway-webapp.azurewebsites.net/ta4h/',
        typeLabel: '<ayalon host name>'
    },
    {
        name: 'ayalonKey',
        type: String,
        description: 'Ayalon service API key',
        typeLabel: '<ayalon api key>'        
    },
    {
        name: 'location',
        alias: 'l',
        type: String,
        description: 'Azure region of LUIS authoring service (default: westus)',
        defaultValue: 'westus',
        typeLabel: 'westus'
    }
]

const options = commandLineArgs(optionDefinitions);

if (options.help) {
    const usage = commandLineUsage([
        {
            header: 'Example',
            content: 'ayalon2luis -a "sample app" -k <authoring key> --ayalonKey <ayalon key> -f ./examples.csv'
        },
        {
            header: 'Options',
            optionList: optionDefinitions
        },
        {
            content: `Project home: {underline https://github.com/arieschwartzman/LuisFromAyalon}`
        }
    ])
    console.log(usage);
    return;
} else {    
    if (!options.luisApp) {
        console.error(chalk.red('Missing LUIS application name. Use ayalon2luis -h for help'));
        return;
    }
    if (!options.luisAuthoringKey) {
        console.error(chalk.red('Missing luisAuthoringKey. Use ayalon2luis -h for help '));
        return;
    }
    if (!options.ayalonKey) {
        console.error(chalk.red('Missing ayalonKey. Use ayalon2luis -h for help '));
        return;
    }
    if (!options.examplesFile || !options.examplesFile.exists) {
        if (!options.examplesFile) {
            console.error(chalk.red(`Missing examples file. Use ayalon2luis -h for help`));
            return;
        }
        if (!options.examplesFile.exists) {
            console.error(chalk.red(`Can't find ${options.examplesFile.filename} examples file. Use ayalon2luis -h for help`));
            return;
        }        
    }
}


/* add utterances parameters */
var configAddUtterances = {
    LUIS_subscriptionKey: options.luisAuthoringKey,
    LUIS_appId: LUIS_appId,
    LUIS_versionId: LUIS_versionId,
    inFile: path.join('./', uploadFile),
    batchSize: 100,
    uri: `https://${options.location}.api.cognitive.microsoft.com/luis/api/v2.0/apps/{appId}/versions/{versionId}/examples`
};

/* create app parameters */
var configCreateApp = {
    LUIS_subscriptionKey: options.luisAuthoringKey,
    LUIS_versionId: LUIS_versionId,
    appName: options.luisApp,
    culture: LUIS_appCulture,
    uri: `https://${options.location}.api.cognitive.microsoft.com/luis/api/v2.0/apps/`
};

/* add intents parameters */
var configAddIntents = {
    LUIS_subscriptionKey: options.luisAuthoringKey,
    LUIS_appId: LUIS_appId,
    LUIS_versionId: LUIS_versionId,
    intentList: intents,
    uri: `https://${options.location}.api.cognitive.microsoft.com/luis/api/v2.0/apps/{appId}/versions/{versionId}/intents`
};

/* add entities parameters */
var configAddEntities = {
    LUIS_subscriptionKey: options.luisAuthoringKey,
    LUIS_appId: LUIS_appId,
    LUIS_versionId: LUIS_versionId,
    entityList: entities,
    uri: `https://${options.location}.api.cognitive.microsoft.com/luis/api/v2.0/apps/{appId}/versions/{versionId}/entities`
};

/* input and output files for parsing CSV */
var configParse = {
    inFile: path.join('./', options.examplesFile.filename),
    outFile: path.join('./', uploadFile)
};

var configAyalon = {
    uri: options.ayalonHostName + '/text/analytics/v3.2-preview.1/entities/health',
    key: options.ayalonKey
}


// Parse CSV
parse(configParse, configAyalon)
    .then((model) => {
        // Save intent and entity names from parse
        intents = model.intents;
        entities = model.entities;
        // Create the LUIS app
        return createApp(configCreateApp);

    }).then((appId) => {
        // Add intents
        LUIS_appId = appId;
        configAddIntents.LUIS_appId = appId;
        configAddIntents.intentList = intents;
        return addIntents(configAddIntents);

    }).then(() => {
        // Add entities
        configAddEntities.LUIS_appId = LUIS_appId;
        configAddEntities.entityList = entities;
        return addEntities(configAddEntities);

    }).then(() => {
        // Add example utterances to the intents in the app
        configAddUtterances.LUIS_appId = LUIS_appId;
        return upload(configAddUtterances);

    }).catch(err => {
        // console.error(chalk.red(err.message));
    });
