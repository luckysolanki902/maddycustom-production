const mongoose = require('mongoose')

const ComboSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 100,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000,
        trim: true,
    },
    price: {
        type: Number,
        required: true,
    },
    thumbnail: {
        type: String,
        required: true,
    },
    items: [
        {
            category: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'SpecificCategory',
                required: true,
            },
            quantity: {
                type: Number,
                required: true,
            },
        }
    ],
    pageSlug: {
        type: String,
        required: true,
        unique: true,
    }

})