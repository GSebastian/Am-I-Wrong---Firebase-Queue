var express = require('express');
var admin = require('firebase-admin');
var Queue = require('firebase-queue');
const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');

var serviceAccount = require('./service-account-key.json');
var FirebaseManager = require('./firebase-manager');

class MainClass {

    constructor() {
        this.app = express();

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "SANITIZED"
        });

        this.firebaseManager = new FirebaseManager(this.ROOT_NODE);

        this.queueRef = admin.database().ref('/Queue');

        this.transporter = nodemailer.createTransport(mg({
            auth: {
                api_key: 'SANITIZED',
                domain: 'SANITIZED'
            }
        }));

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
            'numWorkers': 1,
            'specId': 'vote'
        };
        this.votesQueue = new Queue(this.queueRef, votesQueueOptions, (data, progress, resolve, reject) => {
            // Read and process task data
            console.log(data);

            this.handleVote(data, progress, resolve, reject);
        });

        let reportsQueueOptions = {
            'numWorkers': 5,
            'specId': 'report'
        };
        this.reportsQueue = new Queue(this.queueRef, reportsQueueOptions, (data, progress, resolve, reject) => {
            // Read and process task data
            console.log(data);

            this.handleReport(data, progress, resolve, reject);
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

    handleReport(task, progress, resolve, reject) {

        let questionId = task.questionId;

        this.firebaseManager.fetchQuestion(questionId, questionData => {
            let question = questionData.text;

            let mailOptions = {
                from: '"AIW Report Bot" <noreply@amiwrong.com>', // sender address
                to: 'seb@roboto.studio', // list of receivers
                subject: questionId, // Subject line
                text: 'Reported for spam or offensive content \n\n Question: ' + question, // plain text body
            };

            this.transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    reject();
                    return console.log(error);
                }
                console.log('Report mail sent');
                resolve();
            });
        });
    }

}

var firebaseBackend = new MainClass();