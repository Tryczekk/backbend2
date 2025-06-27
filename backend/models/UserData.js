const mongoose = require('mongoose');

const UserDataSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    data: { type: Object, default: {} }
});

module.exports = mongoose.model('UserData', UserDataSchema);
