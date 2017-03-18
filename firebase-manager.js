var admin = require('firebase-admin');

class FirebaseManager {

    constructor() {
    }

    fetchQuestion(questionId, callback) {
        let firebase = admin.database().ref("Questions/" + questionId);

        firebase.once('value').then(function (snapshot) {
            callback(snapshot.val())
        });
    }

    saveQuestion(questionId, question, callback) {
        let firebase = admin.database().ref("Questions/" + questionId);

        firebase.set(question)
            .then(() => {
                callback(null);
            })
            .catch(error => {
                callback(error);
            });
    }
}

module.exports = FirebaseManager;