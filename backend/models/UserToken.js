const mongoose = require('mongoose');

const UserTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    uses: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserToken', UserTokenSchema);
