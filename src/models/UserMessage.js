const mongoose = require('mongoose')

const UserMessageSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    message: {
        type: Object,
    }
})

module.exports = mongoose.models.UserMessage || mongoose.model('UserMessage', UserMessageSchema);