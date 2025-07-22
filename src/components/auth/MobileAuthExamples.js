/**
 * MobileAuth Component Usage Examples
 * 
 * This file demonstrates various ways to use the MobileAuth component
 * across different parts of the application.
 */

import React, { useState } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import MobileAuth from './MobileAuth';

// Example 1: Basic usage as a standalone component
export const BasicMobileAuth = () => {
  const [user, setUser] = useState(null);

  const handleSuccess = (userData) => {
    setUser(userData);
    console.log('User authenticated:', userData);
  };

  const handleError = (error) => {
    console.error('Authentication error:', error);
  };

  return (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <CardContent>
        <MobileAuth
          onSuccess={handleSuccess}
          onError={handleError}
          title="Login to Continue"
          subtitle="Enter your mobile number to get started"
        />
        {user && (
          <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
            Welcome, {user.name}!
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Example 2: Custom styled version
export const CustomStyledMobileAuth = () => {
  return (
    <Box sx={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      p: 4,
      borderRadius: 3
    }}>
      <MobileAuth
        onSuccess={(user) => console.log('Success:', user)}
        onError={(error) => console.log('Error:', error)}
        title="Join MaddyCustom"
        subtitle="Get exclusive access to custom designs"
        containerStyle={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          padding: '2rem',
          backdropFilter: 'blur(10px)'
        }}
        buttonStyle={{
          background: 'linear-gradient(45deg, #667eea, #764ba2)',
          borderRadius: '25px',
          py: 1.5,
          '&:hover': {
            background: 'linear-gradient(45deg, #764ba2, #667eea)',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)'
          }
        }}
      />
    </Box>
  );
};

// Example 3: Inline usage without dialog
export const InlineMobileAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto', p: 3 }}>
      <Typography variant="h5" gutterBottom align="center">
        Checkout
      </Typography>
      
      {!isAuthenticated ? (
        <MobileAuth
          onSuccess={() => setIsAuthenticated(true)}
          onError={(error) => alert(error)}
          title="Verify Your Number"
          subtitle="We need to verify your mobile number before proceeding"
          showCloseButton={false}
        />
      ) : (
        <Typography variant="h6" color="success.main" align="center">
          ✅ Phone verified! You can now proceed with checkout.
        </Typography>
      )}
    </Box>
  );
};

// Example 4: With custom snackbar handling
export const MobileAuthWithCustomNotifications = () => {
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });

  const showCustomNotification = (message, type = 'info') => {
    setNotification({ open: true, message, type });
    // Auto hide after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, open: false }));
    }, 3000);
  };

  return (
    <Box>
      <MobileAuth
        onSuccess={(user) => {
          showCustomNotification(`Welcome back, ${user.name}!`, 'success');
        }}
        onError={(error) => {
          showCustomNotification(error, 'error');
        }}
        showSnackbar={showCustomNotification}
        title="Sign In"
      />
      
      {/* Custom notification display */}
      {notification.open && (
        <Box sx={{ 
          position: 'fixed', 
          top: 20, 
          right: 20, 
          bg: notification.type === 'error' ? 'red' : 'green',
          color: 'white',
          p: 2,
          borderRadius: 1,
          zIndex: 9999
        }}>
          {notification.message}
        </Box>
      )}
    </Box>
  );
};

// Example 5: Page-level authentication guard
export const AuthGuardExample = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <Card sx={{ maxWidth: 400, width: '100%', mx: 2 }}>
          <CardContent sx={{ p: 4 }}>
            <MobileAuth
              onSuccess={() => setIsAuthenticated(true)}
              onError={(error) => console.error(error)}
              title="Authentication Required"
              subtitle="Please sign in to access this page"
              showCloseButton={false}
            />
          </CardContent>
        </Card>
      </Box>
    );
  }

  return children;
};
