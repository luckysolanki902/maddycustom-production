import mongoose from 'mongoose'

const brandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String,
    },
    logo: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    
}, {timestamps: true})

module.exports = mongoose.models.Brand || mongoose.model('Brand', brandSchema)