# Quick Start Guide - MaddyCustom Platform

**Last Updated**: October 1, 2025  
**Version**: 4.0.0

---

## ⚡ Quick Start (5 Minutes)

### Prerequisites
- Node.js 18+ installed
- MongoDB account (Atlas recommended)
- Git installed

### Steps

```bash
# 1. Clone the repository
git clone <repository-url>
cd maddycustom

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# 4. Run development server
npm run dev

# 5. Open browser
# Navigate to http://localhost:3000
```

---

## 📋 Detailed Setup

### 1. Environment Variables

Create `.env.local` in the project root with the following variables:

```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# Next.js
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_CLOUDFRONT_BASEURL=https://your-cdn-url.cloudfront.net

# Razorpay Payment
NEXT_PUBLIC_RAZORPAY_KEY=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key

# AWS (for S3 and SES)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name

# SMS Services
MSG91_API_KEY=your_msg91_api_key
MSG91_SENDER_ID=MADDYS
MSG91_RESTOCK_TEMPLATE_ID=your_template_id
MSG91_RESTOCK_DLT_TEMPLATE_ID=your_dlt_template_id

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# WhatsApp (AiSensy)
AISENSY_API_KEY=your_aisensy_api_key

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Shiprocket
SHIPROCKET_EMAIL=your_email@domain.com
SHIPROCKET_PASSWORD=your_password

# Google APIs (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# OpenAI (Optional)
OPENAI_API_KEY=your_openai_api_key

# Meta Pixel (Optional)
NEXT_PUBLIC_META_PIXEL_ID=your_pixel_id

# Google Analytics (Optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
```

### 2. MongoDB Setup

#### Option A: MongoDB Atlas (Recommended)
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Create database user
4. Whitelist your IP (0.0.0.0/0 for development)
5. Get connection string
6. Add to `MONGODB_URI` in `.env.local`

#### Option B: Local MongoDB
```bash
# Install MongoDB locally
# macOS
brew install mongodb-community

# Ubuntu
sudo apt install mongodb

# Start MongoDB
mongod --dbpath /path/to/data/directory

# Update .env.local
MONGODB_URI=mongodb://localhost:27017/maddycustom
```

### 3. Run the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start

# Lint code
npm run lint
```

### 4. Verify Installation

Open browser and check:
- ✅ Homepage loads: http://localhost:3000
- ✅ Product pages: http://localhost:3000/shop
- ✅ Console shows no errors
- ✅ MongoDB connection successful

---

## 🗂️ Understanding the Codebase

### Key Files to Know

#### 1. Root Configuration
```
next.config.mjs       # Next.js configuration
package.json          # Dependencies
jsconfig.json         # JavaScript configuration
.env.local            # Environment variables
vercel.json           # Deployment config
```

#### 2. App Entry Points
```
src/app/layout.js     # Root layout (global providers)
src/app/page.js       # Homepage
src/middleware.js     # Next.js middleware
```

#### 3. Core Directories
```
src/app/              # Pages and API routes
src/components/       # React components
src/lib/              # Utilities and helpers
src/models/           # Database models
src/store/            # Redux store
```

---

## 🎯 Common Development Tasks

### Adding a New Product

#### 1. Via MongoDB
```javascript
// Connect to MongoDB and insert
{
  name: "Product Name",
  title: "Product Title",
  category: "Wraps",
  subCategory: "Bike Wraps",
  specificCategory: ObjectId("..."),
  specificCategoryVariant: ObjectId("..."),
  price: 599,
  MRP: 799,
  images: ["/products/image1.jpg"],
  sku: "PROD-001",
  pageSlug: "/bike-wraps/product-name",
  available: true,
  productSource: "inhouse"
}
```

#### 2. Upload Images
- Upload to AWS S3 or public/images/
- Update `images` array in product

### Creating a New API Endpoint

```javascript
// src/app/api/your-endpoint/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import YourModel from '@/models/YourModel';

export async function GET(request) {
  try {
    await connectToDatabase();
    const data = await YourModel.find();
    
    return Response.json({
      success: true,
      data
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    
    const newItem = await YourModel.create(body);
    
    return Response.json({
      success: true,
      data: newItem
    }, { status: 201 });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
```

### Adding a New Redux Slice

```javascript
// src/store/slices/yourSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  data: [],
  loading: false,
  error: null
};

const yourSlice = createSlice({
  name: 'yourFeature',
  initialState,
  reducers: {
    setData: (state, action) => {
      state.data = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  }
});

export const { setData, setLoading, setError } = yourSlice.actions;
export default yourSlice.reducer;
```

```javascript
// src/store/index.js - Add to store
import yourReducer from './slices/yourSlice';

const rootReducer = combineReducers({
  // ... existing reducers
  yourFeature: yourReducer
});
```

### Creating a New Component

```javascript
// src/components/YourComponent.js
'use client'; // If using client-side features

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from './YourComponent.module.css';

const YourComponent = ({ prop1, prop2 }) => {
  const dispatch = useDispatch();
  const data = useSelector(state => state.yourFeature.data);
  
  return (
    <div className={styles.container}>
      <h2>{prop1}</h2>
      <p>{prop2}</p>
    </div>
  );
};

export default YourComponent;
```

---

## 🧪 Testing Your Changes

### Manual Testing Checklist

#### Product Flow
- [ ] Homepage loads correctly
- [ ] Product listings display
- [ ] Product detail page shows all info
- [ ] Add to cart works
- [ ] Cart drawer opens
- [ ] Quantity adjustment works
- [ ] Checkout flow completes

#### Payment Testing
```javascript
// Razorpay Test Cards
Card Number: 4111 1111 1111 1111
CVV: Any 3 digits
Expiry: Any future date
```

#### API Testing
```bash
# Using curl
curl http://localhost:3000/api/products/search?q=wrap

# Using Postman/Insomnia
GET http://localhost:3000/api/products/search?q=wrap
```

### Debugging Tools

#### 1. Console Logs
```javascript
console.log('[Debug]', data);
console.error('[Error]', error);
console.warn('[Warning]', warning);
```

#### 2. Redux DevTools
- Install Redux DevTools browser extension
- View state changes in real-time
- Time-travel debugging

#### 3. React DevTools
- Install React DevTools browser extension
- Inspect component tree
- View props and state

#### 4. Network Tab
- Monitor API requests
- Check response times
- Debug failed requests

#### 5. Funnel Tracking Debug
```
# Add to URL for funnel debugging
http://localhost:3000?debugFunnel=true
```

---

## 📚 Learning Resources

### Documentation Structure
```
readmeFiles/
├── 01-Overview/           # Business understanding
├── 02-Architecture/       # Technical architecture
├── 03-Data-Models/        # Database schemas
├── 04-Features/           # Feature documentation
├── 05-Components/         # Component guides
├── 06-APIs/               # API reference
├── 07-Analytics/          # Analytics setup
└── 08-Development/        # Developer guides
```

### Recommended Reading Order
1. **Start Here**: `README.md` (main index)
2. **Business Context**: `01-Overview/01-Brand-Identity.md`
3. **Technical Setup**: `02-Architecture/01-Tech-Stack.md`
4. **Data Understanding**: `03-Data-Models/01-Product-Models.md`
5. **Feature Deep Dive**: Pick from `04-Features/`

### Key Technologies to Learn
- **Next.js 15**: [nextjs.org/docs](https://nextjs.org/docs)
- **React 18**: [react.dev](https://react.dev)
- **Redux Toolkit**: [redux-toolkit.js.org](https://redux-toolkit.js.org)
- **Material-UI**: [mui.com](https://mui.com)
- **MongoDB**: [mongodb.com/docs](https://www.mongodb.com/docs)
- **Mongoose**: [mongoosejs.com](https://mongoosejs.com)

---

## 🚨 Common Issues & Solutions

### Issue: MongoDB Connection Fails
```bash
# Error: MongoServerError: bad auth
# Solution: Check MONGODB_URI credentials
# Ensure IP is whitelisted in MongoDB Atlas
```

### Issue: Module Not Found
```bash
# Error: Module not found: Can't resolve '@/...'
# Solution: Check jsconfig.json paths
# Run: npm install
```

### Issue: Environment Variables Not Working
```bash
# Solution: Restart dev server after changing .env.local
# Server-side vars don't need NEXT_PUBLIC_ prefix
# Client-side vars MUST have NEXT_PUBLIC_ prefix
```

### Issue: Hydration Errors
```bash
# Error: Hydration failed
# Cause: Server HTML doesn't match client
# Solution: 
# - Use 'use client' for client-only components
# - Check for browser-only APIs (window, localStorage)
# - Use useEffect for client-side only code
```

### Issue: API Route 404
```bash
# Error: 404 on /api/endpoint
# Solution:
# - Check file is named route.js (not index.js)
# - Must export GET, POST, etc. functions
# - Restart dev server
```

---

## 🔧 Development Workflow

### Daily Development
```bash
# 1. Start day - pull latest changes
git pull origin main

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Start dev server
npm run dev

# 4. Make changes and test

# 5. Commit changes
git add .
git commit -m "feat: description of changes"

# 6. Push to remote
git push origin feature/your-feature-name

# 7. Create pull request on GitHub
```

### Code Quality
```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix

# Check build
npm run build
```

### Before Committing
- ✅ Code compiles without errors
- ✅ No console errors in browser
- ✅ Tested manually
- ✅ Linter passes
- ✅ Relevant documentation updated

---

## 📞 Getting Help

### Documentation
- Main docs: `readmeFiles/README.md`
- Architecture: `readmeFiles/02-Architecture/`
- API docs: `readmeFiles/06-APIs/`

### Support Channels
- **GitHub Issues**: For bugs and features
- **Email**: contact.maddycustoms@gmail.com
- **Team**: Contact development team lead

### Debugging Tips
1. Check browser console for errors
2. Check server terminal for API errors
3. Use React DevTools to inspect components
4. Use Redux DevTools to check state
5. Check Network tab for failed API calls
6. Enable funnel debugging: `?debugFunnel=true`
7. Review relevant documentation in `readmeFiles/`

---

## 🎓 Next Steps

### Week 1: Foundation
- [ ] Set up local development environment
- [ ] Explore the codebase structure
- [ ] Read architecture documentation
- [ ] Understand data models
- [ ] Make a small UI change

### Week 2: Features
- [ ] Study cart and checkout flow
- [ ] Understand Redux state management
- [ ] Learn API route structure
- [ ] Implement a small feature

### Week 3: Advanced
- [ ] Study funnel tracking system
- [ ] Understand payment integration
- [ ] Learn inventory management
- [ ] Optimize performance

### Week 4: Mastery
- [ ] Understand full order lifecycle
- [ ] Learn analytics implementation
- [ ] Study security practices
- [ ] Contribute to major feature

---

## 🚀 Production Deployment

### Vercel Deployment (Recommended)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Production deployment
vercel --prod
```

### Environment Variables
- Set all `.env.local` variables in Vercel dashboard
- Update `NEXT_PUBLIC_BASE_URL` to production URL
- Update CDN URLs to production CloudFront

### Pre-Deployment Checklist
- [ ] All environment variables set
- [ ] Database uses production cluster
- [ ] Payment gateway in live mode
- [ ] CDN configured correctly
- [ ] Analytics tags active
- [ ] Test complete user flow
- [ ] Check mobile responsiveness
- [ ] Run performance audit

---

*Happy Coding! Build amazing features for India's leading vehicle personalization platform* 🚀
