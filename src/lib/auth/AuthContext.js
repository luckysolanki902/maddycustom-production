// @/lib/auth/AuthContext.js
'use client';

import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  useMemo 
} from 'react';
import axios from 'axios';

// Create auth context
const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  sendOTP: async () => {},
  verifyOTP: async () => {},
  refreshUserData: async () => {},
});

// Provider component
export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize auth state by validating token
  const refreshUserData = useCallback(async () => {
    try {
      setIsLoading(true);

      const storedToken = localStorage.getItem('authToken');
      
      if (!storedToken) {
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return null;
      }

      // Validate token
      const response = await axios.get('/api/auth/validate-token', {
        headers: {
          Authorization: `Bearer ${storedToken}`
        }
      });

      if (response.data.isValid) {
        setIsAuthenticated(true);
        setUser(response.data.user);
        return response.data.user;
      } else {
        // Invalid token, clear auth
        setIsAuthenticated(false);
        setUser(null);
        localStorage.removeItem('authToken');
        return null;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setIsAuthenticated(false);
      setUser(null);
      // Clear invalid token
      localStorage.removeItem('authToken');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check auth state on initial load
  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  // Send OTP function
  const sendOTP = async (phoneNumber, authMethod = 'whatsapp') => {
    try {
      setAuthError(null);
      const response = await axios.post('/api/auth/send-otp', { 
        phoneNumber, 
        authMethod 
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Send OTP error:', error);
      
      setAuthError(
        error.response?.data?.message || 
        'Failed to send OTP. Please try again.'
      );
      
      return {
        success: false,
        error: error.response?.data || { message: 'Failed to send OTP' },
        waitTime: error.response?.data?.waitTime
      };
    }
  };

  // Verify OTP function
  const verifyOTP = async (phoneNumber, otp) => {
    try {
      setAuthError(null);
      setIsLoading(true);
      
      const response = await axios.post('/api/auth/verify-otp', { 
        phoneNumber, 
        otp 
      });
      
      // Store token in localStorage for client-side use
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
      }
      
      // Update auth state
      setIsAuthenticated(true);
      setUser(response.data.user);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Verify OTP error:', error);
      
      setAuthError(
        error.response?.data?.message || 
        'Invalid OTP. Please try again.'
      );
      
      return {
        success: false,
        error: error.response?.data || { message: 'Failed to verify OTP' },
        remainingAttempts: error.response?.data?.remainingAttempts
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Call logout API
      await axios.post('/api/auth/logout');
      
      // Clear client-side auth state
      localStorage.removeItem('authToken');
      setIsAuthenticated(false);
      setUser(null);
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { 
        success: false, 
        error: 'Failed to log out properly'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Combine login functions for convenience
  const login = async (phoneNumber, authMethod = 'whatsapp') => {
    return await sendOTP(phoneNumber, authMethod);
  };

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    isAuthenticated,
    user,
    isLoading,
    authError,
    login,
    logout,
    sendOTP,
    verifyOTP,
    refreshUserData,
  }), [
    isAuthenticated, 
    user, 
    isLoading, 
    authError, 
    refreshUserData
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
