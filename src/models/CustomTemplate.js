// /models/customTemplate.js
const mongoose = require('mongoose');


const customTemplateSchema = new mongoose.Schema({
    // Relative Url
    baseImage: {
        type: String,
        required: true,
    },
    // Template dimensions
    dimensions: {
        length: {
            type: Number,
            required: true,
        },
        width: {
            type: Number,
            required: true,
        },
        padding: {
            left: {
                type: Number,
                required: true,
            },
            right: {
                type: Number,
                required: true,
            },
            top: {
                type: Number,
                required: true,
            },
            bottom: {
                type: Number,
                required: true,
            }
        }
    },
    customCharges: {
        type: Number,
        default: 100,
    }
})