// @/lib/middleware/authMiddleware.js
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectToDatabase from './connectToDb';
import User from '@/models/User';

/**
 * Authentication middleware for API routes
 * Verifies JWT token and attaches user to the request
 * 
 * @param {function} handler - The API route handler
 * @returns {function} - The wrapped handler with authentication
 */
export function withAuth(handler) {
  return async (req, context) => {
    try {
      const authHeader = req.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      
      if (!token) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }

      try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Connect to database
        await connectToDatabase();
        
        // Get the user
        const user = await User.findById(decoded.id).select('+authToken +authTokenExpiry');
        
        if (!user || !user.authToken || user.authToken !== token) {
          return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }
        
        // Check token expiry
        if (user.authTokenExpiry && new Date(user.authTokenExpiry) < new Date()) {
          return NextResponse.json({ message: 'Token expired' }, { status: 401 });
        }
        
        // Attach user to request
        req.user = user;
        
        // Call the handler
        return handler(req, context);
        
      } catch (error) {
        console.error('Auth middleware error:', error.message);
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }
    } catch (error) {
      console.error('Auth middleware critical error:', error.message);
      return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
  };
}

/**
 * Optional authentication middleware for API routes
 * Verifies JWT token if present but doesn't require it
 * 
 * @param {function} handler - The API route handler
 * @returns {function} - The wrapped handler with optional authentication
 */
export function withOptionalAuth(handler) {
  return async (req, context) => {
    try {
      const authHeader = req.headers.get('Authorization');
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        
        if (token) {
          try {
            // Verify the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Connect to database
            await connectToDatabase();
            
            // Get the user
            const user = await User.findById(decoded.id).select('+authToken +authTokenExpiry');
            
            if (user && user.authToken === token && (!user.authTokenExpiry || new Date(user.authTokenExpiry) >= new Date())) {
              // Attach user to request
              req.user = user;
            }
          } catch (error) {
            // Ignore errors in optional auth
            console.info('Optional auth verification failed:', error.message);
          }
        }
      }
      
      // Call the handler regardless of auth status
      return handler(req, context);
    } catch (error) {
      console.error('Optional auth middleware error:', error.message);
      return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
  };
}
