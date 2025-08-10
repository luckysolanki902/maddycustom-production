import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const displayAssetSchema = new mongoose.Schema({
    componentId: {
        type: String,
        default: uuidv4,
        unique: true
    },
    componentName: {
        type: String, // e.g., "Homepage Hero Slider"
        required: true,
        trim: true
    },
    componentType: {
        type: String,
        enum: ['slider', 'carousel', 'banner','custom'],
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    }, // will work as alt text for images else not needed
    
    content2: {
        type: String,
        trim: true
    }, // secondary content like price, subtitle, etc.

    media: {
        desktop: {
            type: String, // URL for desktop image/video
            trim: true
        },
        mobile: {
            type: String, // URL for mobile image/video
            trim: true
        }
    },
    useSameMediaForAllDevices: {
        type: Boolean,
        default: true // true = use desktop media for all devices
    },
    mediaType: {
        type: String,
        enum: ['image', 'video', 'none'], 
        default: 'image'
    },
    link: {
        type: String, // URL to product, category, or custom page
        trim: true
    },
    page: {
        type: String,
        enum: ['homepage', 'product-list', 'product-detail'], // will add more later
        required: true
    },
    position: {
        type: String, // for drag/drop ordering, e.g., "1", "1a",
        default: '0'
    },
    
    // Seasonal logic
    displayFrom: {
        type: Date, // Start date/time
        default: null
    },
    displayTo: {
        type: Date, // End date/time
        default: null
    },
    recurringRule: {
        type: String,
        enum: [
            'none', // No recurrence
            'last-5-days-of-month',
            'first-week-of-month',
            'weekends-only',
            'custom' // Use a cron-like expression or custom frontend logic
        ],
        default: 'none'
    },

    isActive: {
        type: Boolean,
        default: true
    },
}, {timestamps: true});

// Create index for content and page combination for faster queries (not unique)
displayAssetSchema.index({ content: 1, page: 1 });

export default mongoose.models.DisplayAsset || mongoose.model('DisplayAsset', displayAssetSchema);
