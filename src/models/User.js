const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema(
  {
    // Phone number used for login
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{10}$/,
    },
    // User's name
    name: {
      type: String,
      maxlength: 100,
      required: false,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      //validation for email:
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please add a valid email address"],
    },
    // Array of address objects
    addresses: [
      {
        receiverName: {
          type: String,
          required: true,
          maxlength: 100,
        },
        receiverPhoneNumber: {
          type: String,
          required: true,
          match: /^\d{10}$/,
        },
        addressLine1: {
          type: String,
          required: true,
          maxlength: 200,
        },
        // Optional
        addressLine2: {
          type: String,
          maxlength: 200,
        },
        city: {
          type: String,
          required: true,
          maxlength: 100,
        },
        state: {
          type: String,
          required: true,
          maxlength: 100,
        },
        country: {
          type: String,
          default: "India",
          maxlength: 100,
        },
        pincode: {
          type: String,
          required: true,
          maxlength: 10,
        },
        isPrimary: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Authentication related fields
    otpDetails: {
      otp: {
        type: String,
        select: false, // Don't include in query results by default
      },
      otpExpiry: {
        type: Date,
        select: false,
      },
      resendAllowedAt: {
        type: Date,
        select: false,
      },
      otpAttempts: {
        type: Number,
        default: 0,
        select: false,
      },
    },
    authToken: {
      type: String,
      select: false,
    },
    authTokenExpiry: {
      type: Date,
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
    preferredAuthMethod: {
      type: String,
      enum: ["whatsapp", "sms"],
      default: "whatsapp",
    },

    // Indicates if the user is verified atleast once in a lifetime
    isVerified: {
      type: Boolean,
      default: false,
    },
    // source from where user is created (like meta ads etc) nothing to do with login
    // this is used for analytics and marketing purposes
    source: {
      type: String,
      default: "unknown",
    },
    shiprocketCustomerData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// Method to generate JWT token
UserSchema.methods.generateAuthToken = function() {
  const token = jwt.sign(
    { id: this._id, phoneNumber: this.phoneNumber },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  this.authToken = token;
  this.authTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  return token;
};

// Method to generate OTP
UserSchema.methods.generateOTP = function({ isShiprocket = false }) {
  // Generate a 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  
  // Store hashed OTP for security
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
  
  this.otpDetails = {
    otp: isShiprocket ? null : hashedOTP,
    otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
    resendAllowedAt: new Date(Date.now() + 60 * 1000), // Allow resend after 1 minute
    otpAttempts: 0,
  };
  
  return otp;
};

// Method to verify OTP
UserSchema.methods.verifyOTP = function(otp) {
  // If OTP has expired
  if (this.otpDetails.otpExpiry < new Date()) {
    return { success: false, message: 'OTP has expired' };
  }

  // If too many attempts
  if (this.otpDetails.otpAttempts >= 5) {
    return { success: false, message: 'Too many attempts. Please request a new OTP' };
  }

  // Hash the provided OTP to compare with stored hash
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
  
  // Increment attempt counter
  this.otpDetails.otpAttempts += 1;
  
  // Check if OTP matches
  if (this.otpDetails.otp === hashedOTP) {
    // Clear OTP data after successful verification
    this.otpDetails = {
      otp: undefined,
      otpExpiry: undefined,
      resendAllowedAt: undefined,
      otpAttempts: 0,
    };
    // Update last login timestamp
    this.lastLoginAt = new Date();
    // Set as verified
    this.isVerified = true;
    
    return { success: true };
  }
  
  return { success: false, message: 'Invalid OTP' };
};

if (mongoose.models.User) {
  delete mongoose.models.User;
}

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);

