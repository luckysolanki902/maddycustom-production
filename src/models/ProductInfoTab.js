const mongoose = require('mongoose');

const ProductInfoTabSchema = new mongoose.Schema({
    title:{
        type: String,
        maxlength: 100,
        trim: true,
    },
    content:{
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },  
    // images
    images: [
        {
            type: String,
        },
    ],
    
     // References to “scope”
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          index: true,
        },
        specificCategoryVariant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SpecificCategoryVariant',
          index: true,
        },
        specificCategory: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SpecificCategory',
          index: true,
        },
},{
    timestamps: true,
});

// validate either one of three references is mandatory
ProductInfoTabSchema.pre('save', function(next){
    if(!this.product && !this.specificCategoryVariant && !this.specificCategory){
        next(new Error('At least one of product, specificCategoryVariant or specificCategory is required'));
    }else{
        next();
    }
});


module.exports = mongoose.models.ProductInfoTab || mongoose.model('ProductInfoTab', ProductInfoTabSchema);