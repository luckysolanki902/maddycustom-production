const mongoose = require('mongoose');

const SearchQuerySchema = new mongoose.Schema({
    query: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
    },
    clickedPageSlug: {
        type: String,
        required: false,
        trim: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true,
    },
    sessionId: {
        type: String,
        required: false,
        index: true,
    },
}, {
    timestamps: true,
});

// Indexes for efficient querying
SearchQuerySchema.index({ timestamp: -1 });
SearchQuerySchema.index({ query: 1, timestamp: -1 });
SearchQuerySchema.index({ clickedPageSlug: 1, timestamp: -1 });

// Method to add a new search query with deduplication
SearchQuerySchema.statics.logSearch = async function (queryData) {
    try {
        const currentTime = new Date();
        const fiveSecondsAgo = new Date(currentTime.getTime() - 5000);

        // Check for duplicate entries within the last 5 seconds for the same session
        const existingQuery = await this.findOne({
            query: queryData.query,
            sessionId: queryData.sessionId,
            clickedPageSlug: queryData.clickedPageSlug || { $exists: false },
            timestamp: { $gte: fiveSecondsAgo }
        }).lean();

        // If duplicate found, don't create a new entry
        if (existingQuery) {
            console.log('Duplicate search query prevented:', queryData.query);
            return existingQuery;
        }

        const searchDoc = await this.create({
            query: queryData.query,
            timestamp: queryData.timestamp || currentTime,
            clickedPageSlug: queryData.clickedPageSlug,
            userId: queryData.userId,
            sessionId: queryData.sessionId,
        });

        return searchDoc;
    } catch (error) {
        console.error('Error logging search query:', error);
        // Don't throw error to avoid affecting user experience
        return null;
    }
};

if (mongoose.models.SearchQuery) {
    delete mongoose.models.SearchQuery;
}

module.exports = mongoose.models.SearchQuery || mongoose.model('SearchQuery', SearchQuerySchema);
