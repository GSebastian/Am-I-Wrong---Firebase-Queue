var express = require('express');
var admin = require('firebase-admin');
var Queue = require('firebase-queue');

var serviceAccount = require('./service-account-key.json');
var FirebaseManager = require('./firebase-manager');

class MainClass {

    constructor() {
        this.app = express();

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "***REMOVED***"
        });

        this.firebaseManager = new FirebaseManager(this.ROOT_NODE);

        this.queueRef = admin.database().ref('/Queue');

        this.startQueues();
    }

    initGracefulShutdown() {
        process.on('SIGINT', () => {
            let shutdownCallback = () => {
                console.log('Finished queue shutdown');
                process.exit(0);
            };

            console.log('Starting queue shutdown');
            this.messageQueue.shutdown().then(shutdownCallback);
            this.eventQueue.shutdown().then(shutdownCallback);
        });
    }

    startQueues() {
        let votesQueueOptions = {
            'numWorkers': 1
        };
        this.votesQueue = new Queue(this.queueRef, votesQueueOptions, (data, progress, resolve, reject) => {
            // Read and process task data
            console.log(data);

            this.handleVote(data, progress, resolve, reject);
        });
    }

    handleVote(task, progress, resolve, reject) {

        let questionId = task.questionId;
        let votedYes = task.yes;

        this.firebaseManager.fetchQuestion(questionId, questionData => {
            if (votedYes) {
                questionData.yes += 1;
                this.firebaseManager.saveQuestion(questionId, questionData, error => {
                    if (error == null) {
                        resolve()
                    } else {
                        reject();
                    }
                });
            } else {
                questionData.no += 1;
                this.firebaseManager.saveQuestion(questionId, questionData, error => {
                    if (error == null) {
                        resolve()
                    } else {
                        reject();
                    }
                });
            }
        });
    }

}

var firebaseBackend = new MainClass();