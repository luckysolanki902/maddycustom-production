// @/store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  otpDetails: {
    phoneNumber: '',
    waitTime: 0,
    resendAllowedAt: null,
    remainingAttempts: 5,
    isOtpSent: false,
  },
};

// Async thunks for authentication
export const sendOTP = createAsyncThunk(
  'auth/sendOTP',
  async ({ phoneNumber, authMethod = 'whatsapp' }, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/auth/send-otp', { 
        phoneNumber, 
        authMethod 
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to send OTP' });
    }
  }
);

export const verifyOTP = createAsyncThunk(
  'auth/verifyOTP',
  async ({ phoneNumber, otp }, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/auth/verify-otp', { 
        phoneNumber, 
        otp 
      });
      
      // Store token in localStorage for client-side use
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
      }
      
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to verify OTP' });
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      // Call logout API
      await axios.post('/api/auth/logout');
      
      // Clear client-side auth state
      localStorage.removeItem('authToken');
      return null;
    } catch (error) {
      return rejectWithValue({ message: 'Failed to logout properly' });
    }
  }
);

export const validateToken = createAsyncThunk(
  'auth/validateToken',
  async (_, { rejectWithValue }) => {
    try {
      const storedToken = localStorage.getItem('authToken');
      
      if (!storedToken) {
        return rejectWithValue({ message: 'No token found' });
      }

      // Validate token
      const response = await axios.get('/api/auth/validate-token', {
        headers: {
          Authorization: `Bearer ${storedToken}`
        }
      });

      return response.data;
    } catch (error) {
      localStorage.removeItem('authToken');
      return rejectWithValue({ message: 'Invalid or expired token' });
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthError: (state) => {
      state.error = null;
    },
    setOtpPhoneNumber: (state, action) => {
      state.otpDetails.phoneNumber = action.payload;
    },
    resetOtpState: (state) => {
      state.otpDetails = {
        phoneNumber: '',
        waitTime: 0,
        resendAllowedAt: null,
        remainingAttempts: 5,
        isOtpSent: false,
      };
    },
    decrementOtpTimer: (state) => {
      if (state.otpDetails.waitTime > 0) {
        state.otpDetails.waitTime -= 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Send OTP
      .addCase(sendOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.otpDetails = {
          ...state.otpDetails,
          phoneNumber: action.payload.phoneNumber,
          waitTime: 60, // 1 minute wait time for resend
          resendAllowedAt: action.payload.resendAllowedAt,
          isOtpSent: true,
        };
      })
      .addCase(sendOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to send OTP';
        state.otpDetails.waitTime = action.payload?.waitTime || 0;
      })
      
      // Verify OTP
      .addCase(verifyOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.otpDetails.isOtpSent = false;
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Invalid OTP';
        state.otpDetails.remainingAttempts = action.payload?.remainingAttempts || state.otpDetails.remainingAttempts - 1;
      })
      
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        return { ...initialState };
      })
      
      // Token validation
      .addCase(validateToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(validateToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
      })
      .addCase(validateToken.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
      });
  },
});

export const { 
  resetAuthError, 
  setOtpPhoneNumber, 
  resetOtpState,
  decrementOtpTimer
} = authSlice.actions;

export default authSlice.reducer;
