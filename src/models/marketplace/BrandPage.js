import mongoose from 'mongoose';

const componentSchema = new mongoose.Schema({
    order: Number,
    // Type1, Type2
    type: String,
    urls: [String],
})

const brandPageSchema = new mongoose.Schema({
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
        required: true,
        index: true,
    },
    pageSlug: {
        type: String,
        required: true,
        unique: true,
    },
    components: [componentSchema]



}, { timestamps: true })


