'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { detectClientIP, getClientIPSync, clearIPCache } from '@/lib/utils/ipDetection';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  Tooltip,
  IconButton,
  InputAdornment,
  Fade,
  Slide,
  Zoom
} from '@mui/material';
import {
  ExpandMore,
  CheckCircle,
  Cancel,
  Warning,
  Info,
  ShoppingCart,
  Visibility,
  VisibilityOff,
  Payment,
  Receipt,
  Lock,
  LockOpen,
  Refresh,
  TrendingUp,
  Speed,
  NetworkCheck,
  Cookie,
  RemoveRedEyeOutlined
} from '@mui/icons-material';

// Test events configuration (matching production usage)
const TEST_EVENTS = [
  {
    name: 'PageView',
    icon: Visibility,
    description: 'Page load tracking',
    color: '#3b82f6',
    testData: {
      content_name: 'Meta Pixel Test Page',
      content_category: 'test',
      content_type: 'website'
    },
    // PageView does NOT send user data in production (only cookies)
    includeUserData: false,
    importance: 'optional', // PageView is less critical for match quality
  },
  {
    name: 'ViewContent',
    icon: RemoveRedEyeOutlined,
    description: 'Product page view',
    color: '#10b981',
    testData: {
      content_name: 'Test Product',
      content_ids: ['test-product-123'],
      content_category: 'test-category',
      content_type: 'product',
      value: 599,
      currency: 'INR',
      contents: [{
        id: 'test-product-123',
        quantity: 1,
        item_price: 599
      }]
    },
    // ViewContent does NOT send user data in production (only cookies)
    includeUserData: false,
    importance: 'high', // Important for remarketing
  },
  {
    name: 'AddToCart',
    icon: ShoppingCart,
    description: 'Item added to cart',
    color: '#f59e0b',
    testData: {
      content_name: 'Test Product',
      content_ids: ['test-product-123'],
      content_type: 'product',
      value: 599,
      currency: 'INR',
      contents: [{
        id: 'test-product-123',
        quantity: 1,
        item_price: 599
      }],
      num_items: 1
    },
    // AddToCart does NOT send user data in production (only product info)
    includeUserData: false,
    importance: 'critical', // Critical for conversion tracking
  },
  {
    name: 'InitiateCheckout',
    icon: Payment,
    description: 'Checkout process started',
    color: '#8b5cf6',
    testData: {
      content_name: 'Test Product',
      content_ids: ['test-product-123'],
      content_category: 'checkout',
      content_type: 'product',
      value: 599,
      currency: 'INR',
      contents: [{
        id: 'test-product-123',
        quantity: 1,
        item_price: 599
      }],
      num_items: 1
    },
    // InitiateCheckout DOES send user data in production (email, phone, firstName)
    includeUserData: true,
    importance: 'critical', // Critical for checkout optimization
  },
  {
    name: 'Purchase',
    icon: CheckCircle,
    description: 'Order completed successfully',
    color: '#10b981',
    testData: {
      content_name: 'Test Product',
      content_ids: ['test-product-123'],
      content_category: 'purchase',
      content_type: 'product',
      value: 599,
      currency: 'INR',
      orderId: 'TEST-ORDER-' + Date.now(),
      contents: [{
        id: 'test-product-123',
        quantity: 1,
        item_price: 599
      }],
      num_items: 1
    },
    // Purchase DOES send user data in production (email, phoneNumber)
    includeUserData: true,
    importance: 'critical', // Most critical for conversion tracking
  },
];

export default function MetaPixelTest() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [testProgress, setTestProgress] = useState(0);
  const [testResults, setTestResults] = useState([]);
  const [currentTestStep, setCurrentTestStep] = useState('');
  const [currentStage, setCurrentStage] = useState('');
  const hasRunTest = useRef(false);
  const hasInitialized = useRef(false);
  
  // IP Detection state
  const [clientIP, setClientIP] = useState(null);
  const [ipDetecting, setIpDetecting] = useState(true);
  const [ipFormat, setIpFormat] = useState(null); // 'IPv4' or 'IPv6'
  
  // Authentication state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Test state
  const [testRunning, setTestRunning] = useState(false);
  const [overallScore, setOverallScore] = useState(0);
  const [overallMetrics, setOverallMetrics] = useState({
    totalEvents: 0,
    pixelSuccess: 0,
    capiSuccess: 0,
    deduplicationSuccess: 0,
    avgMatchQuality: 0
  });
  
  // Check authentication on mount
  useEffect(() => {
    const checkAuth = () => {
      console.log('[Auth] Checking authentication...');
      const authToken = localStorage.getItem('metaTestAuth');
      const authExpiry = localStorage.getItem('metaTestAuthExpiry');
      
      if (authToken && authExpiry) {
        const expiryTime = parseInt(authExpiry);
        if (Date.now() < expiryTime) {
          console.log('[Auth] Valid token found, authenticating...');
          setIsAuthenticated(true);
          setCheckingAuth(false);
          return;
        } else {
          // Token expired
          console.log('[Auth] Token expired, clearing...');
          localStorage.removeItem('metaTestAuth');
          localStorage.removeItem('metaTestAuthExpiry');
        }
      }
      
      console.log('[Auth] Not authenticated, showing password dialog');
      setIsAuthenticated(false);
      setShowPasswordDialog(true);
      setCheckingAuth(false);
    };
    
    checkAuth();
  }, []);
  
  // Detect IP on mount (runs immediately after auth check)
  useEffect(() => {
    const detectIP = async () => {
      console.log('[IP Detection] Starting...');
      setIpDetecting(true);
      
      try {
        // Try sync first (cache)
        let ip = getClientIPSync();
        
        if (!ip) {
          // Detect async
          ip = await detectClientIP();
        }
        
        if (ip) {
          setClientIP(ip);
          
          // Determine format
          const isIPv6 = ip.includes(':');
          setIpFormat(isIPv6 ? 'IPv6' : 'IPv4');
          
          console.log('[IP Detection] Success:', ip, isIPv6 ? 'IPv6' : 'IPv4');
        } else {
          console.warn('[IP Detection] Failed - no IP detected');
        }
      } catch (error) {
        console.error('[IP Detection] Error:', error);
      } finally {
        setIpDetecting(false);
      }
    };
    
    detectIP();
  }, []);
  
  // Helper to refresh IP detection
  const refreshIPDetection = useCallback(async () => {
    console.log('[IP Detection] Refreshing...');
    clearIPCache();
    setIpDetecting(true);
    
    try {
      const ip = await detectClientIP();
      if (ip) {
        setClientIP(ip);
        const isIPv6 = ip.includes(':');
        setIpFormat(isIPv6 ? 'IPv6' : 'IPv4');
        console.log('[IP Detection] Refreshed:', ip);
      }
    } catch (error) {
      console.error('[IP Detection] Refresh error:', error);
    } finally {
      setIpDetecting(false);
    }
  }, []);
  
  // Handle password verification
  const handlePasswordSubmit = async () => {
    setPasswordError('');
    
    try {
      const response = await fetch('/api/test/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Store auth token for 1 hour
        const authToken = uuidv4();
        const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour
        localStorage.setItem('metaTestAuth', authToken);
        localStorage.setItem('metaTestAuthExpiry', expiryTime.toString());
        
        setIsAuthenticated(true);
        setShowPasswordDialog(false);
        setPassword('');
      } else {
        setPasswordError(data.message || 'Invalid password');
      }
    } catch (error) {
      setPasswordError('Failed to verify password');
    }
  };
  
  // Calculate overall metrics and score
  const calculateOverallMetrics = useCallback((results) => {
    const metrics = {
      totalEvents: results.length,
      pixelSuccess: results.filter(r => r.pixelFired).length,
      capiSuccess: results.filter(r => r.capiFired).length,
      deduplicationSuccess: results.filter(r => r.deduplicationWorking).length,
      avgMatchQuality: results.reduce((sum, r) => sum + r.matchQualityScore, 0) / results.length
    };
    
    setOverallMetrics(metrics);
    
    // Calculate overall score (0-100)
    const score = Math.round(
      (metrics.pixelSuccess / metrics.totalEvents) * 25 +
      (metrics.capiSuccess / metrics.totalEvents) * 25 +
      (metrics.deduplicationSuccess / metrics.totalEvents) * 30 +
      (metrics.avgMatchQuality / 10) * 20
    );
    
    setOverallScore(score);
  }, []);
  
  // Run comprehensive test
  const runFullTest = useCallback(async () => {
    console.log('[Test] Starting comprehensive test...');
    setTestRunning(true);
    setTestResults([]);
    setTestProgress(0);
    setCurrentTestStep('Initializing diagnostics');
    setCurrentStage('Preparing test environment');
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Check if Facebook Pixel is loaded
    if (typeof window.fbq === 'undefined') {
      console.error('[Test] Facebook Pixel not loaded!');
      setCurrentTestStep('Error: Facebook Pixel not loaded');
      setCurrentStage('Facebook Pixel not found. Please refresh the page.');
      await new Promise(resolve => setTimeout(resolve, 3000));
      setTestRunning(false);
      return;
    }
    
    setCurrentStage('Meta Pixel loaded successfully');
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Prepare user data for match quality (simulating production)
    const getCookie = (name) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    };
    
    const testUserData = {
      em: 'test.user@example.com', // Will be hashed by CAPI
      ph: '9876543210', // Will be hashed by CAPI
      fn: 'Test',
      ln: 'User',
      ct: 'Mumbai',
      st: 'Maharashtra',
      country: 'IN',
      zp: '400001',
      external_id: 'test-user-123',
      client_ip_address: clientIP || (window.location.hostname === 'localhost' ? '1.1.1.1' : undefined),
      client_user_agent: navigator.userAgent,
      fbc: getCookie('_fbc') || searchParams.get('_fbc') || undefined,
      fbp: getCookie('_fbp') || searchParams.get('_fbp') || undefined,
      event_source_url: window.location.href
    };
    
    console.log('[Test] User data prepared:', {
      hasFbc: !!testUserData.fbc,
      hasFbp: !!testUserData.fbp,
      hasEmail: !!testUserData.em,
      hasPhone: !!testUserData.ph,
      clientIP: testUserData.client_ip_address,
      ipFormat: testUserData.client_ip_address?.includes(':') ? 'IPv6' : 'IPv4'
    });
    
    const results = [];
    const totalEvents = TEST_EVENTS.length;
    
    for (let i = 0; i < TEST_EVENTS.length; i++) {
      const testEvent = TEST_EVENTS[i];
      const eventNum = i + 1;
      const progress = Math.round(((eventNum - 1) / totalEvents) * 100);
      
      setTestProgress(progress);
      setCurrentTestStep(`Testing ${testEvent.name} (${eventNum}/${totalEvents})`);
      setCurrentStage(`Sending ${testEvent.name} to Pixel and CAPI`);
      
      const eventId = `test-${uuidv4()}`;
      const result = {
        eventName: testEvent.name,
        eventId,
        pixelFired: false,
        capiFired: false,
        deduplicationWorking: false,
        matchQualityScore: 0,
        pixelData: null,
        capiData: null,
        timestamp: Date.now()
      };
      
      try {
        // Fire Pixel event
        if (typeof window.fbq !== 'undefined') {
          window.fbq('track', testEvent.name, testEvent.testData, { eventID: eventId });
          result.pixelFired = true;
          result.pixelData = testEvent.testData;
          console.log(`[Test] ${testEvent.name} - Pixel fired`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 400));
        
        // Fire CAPI event - ONLY include user data if the event type requires it (matching production)
        const capiPayload = {
          eventName: testEvent.name,
          options: {
            eventID: eventId,
            ...testEvent.testData,
            // Only include user data for events that send it in production
            ...(testEvent.includeUserData ? testUserData : {
              // Even without user data, still include cookies and external_id
              fbc: testUserData.fbc,
              fbp: testUserData.fbp,
              external_id: testUserData.external_id,
              client_ip_address: testUserData.client_ip_address,
              client_user_agent: testUserData.client_user_agent,
              event_source_url: testUserData.event_source_url
            })
          }
        };
        
        const capiResponse = await fetch('/api/meta/conversion-api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(capiPayload)
        });
        
        const capiData = await capiResponse.json();
        
        if (capiData.message === 'Event sent successfully') {
          result.capiFired = true;
          result.capiData = capiData;
          result.matchQualityScore = capiData.debug?.matchQualityScore || 0;
          result.deduplicationWorking = capiData.debug?.eventID === eventId;
          result.importance = testEvent.importance; // Track event importance
          console.log(`[Test] ${testEvent.name} - CAPI success (Match: ${result.matchQualityScore}/10, Importance: ${testEvent.importance})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 400));
        
      } catch (error) {
        console.error(`[Test] Error testing ${testEvent.name}:`, error);
        setCurrentStage(`Error in ${testEvent.name}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      results.push(result);
    }
    
    setTestProgress(100);
    setCurrentStage('Generating report');
    await new Promise(resolve => setTimeout(resolve, 600));
    
    setTestResults(results);
    calculateOverallMetrics(results);
    
    setCurrentStage('Complete');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setTestRunning(false);
    setCurrentTestStep('');
    setCurrentStage('');
    console.log('[Test] Test completed');
  }, [calculateOverallMetrics, searchParams, clientIP]);
  
  // Redirect with test parameters on mount
  useEffect(() => {
    if (!isAuthenticated || hasInitialized.current) return;
    
    console.log('[Init] Checking test parameters...');
    
    // Check if we already have test params
    const hasFbp = searchParams.get('_fbp');
    const hasFbc = searchParams.get('_fbc');
    const hasTestMode = searchParams.get('test_mode');
    
    if (!hasFbp || !hasFbc || !hasTestMode) {
      console.log('[Init] Missing test params, redirecting...');
      hasInitialized.current = true;
      
      // Generate fake tracking parameters
      const timestamp = Date.now();
      const fakeFbp = `fb.1.${timestamp}.${Math.random().toString(36).substr(2, 9)}`;
      const fakeFbc = `fb.1.${timestamp}.IwAR${Math.random().toString(36).substr(2, 20)}`;
      const fakeFbclid = `IwAR${Math.random().toString(36).substr(2, 20)}`;
      
      // Set cookies manually for testing
      document.cookie = `_fbp=${fakeFbp}; path=/; max-age=7776000`; // 90 days
      document.cookie = `_fbc=fb.1.${timestamp}.${fakeFbclid}; path=/; max-age=7776000`;
      
      console.log('[Init] Set cookies:', { _fbp: fakeFbp, _fbc: `fb.1.${timestamp}.${fakeFbclid}` });
      
      // Redirect with parameters
      const params = new URLSearchParams({
        _fbp: fakeFbp,
        _fbc: `fb.1.${timestamp}.${fakeFbclid}`,
        fbclid: fakeFbclid,
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'test_campaign',
        test_mode: 'true'
      });
      
      router.replace(`/test/ip-extraction?${params.toString()}`);
    } else {
      console.log('[Init] Test params present, waiting for Facebook Pixel...');
      
      // Ensure cookies are set from URL params if not already present
      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
      };
      
      if (!getCookie('_fbp') && hasFbp) {
        document.cookie = `_fbp=${hasFbp}; path=/; max-age=7776000`;
        console.log('[Init] Set _fbp cookie from URL');
      }
      
      if (!getCookie('_fbc') && hasFbc) {
        document.cookie = `_fbc=${hasFbc}; path=/; max-age=7776000`;
        console.log('[Init] Set _fbc cookie from URL');
      }
      
      // Wait for Facebook Pixel to load before starting test
      const checkPixelAndRun = () => {
        if (typeof window.fbq !== 'undefined') {
          console.log('[Init] Facebook Pixel loaded, starting test...');
          hasInitialized.current = true;
          runFullTest();
        } else {
          console.log('[Init] Waiting for Facebook Pixel...');
          setTimeout(checkPixelAndRun, 500);
        }
      };
      
      // Start checking after a short delay
      setTimeout(checkPixelAndRun, 1000);
    }
  }, [isAuthenticated, searchParams, router, runFullTest]);
  
  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };
  
  const getStatusIcon = (success) => {
    if (success) return <CheckCircle sx={{ color: '#10b981' }} />;
    return <Cancel sx={{ color: '#ef4444' }} />;
  };
  
  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#fafafa' }}>
        <CircularProgress sx={{ color: '#2d2d2d' }} />
      </Box>
    );
  }
  
  // Show password dialog if not authenticated
  if (!isAuthenticated) {
    console.log('[Render] Showing password screen');
    return (
      <Fade in={true} timeout={800}>
        <Box sx={{ 
          minHeight: '100vh', 
          width: '100vw',
          bgcolor: '#2d2d2d', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          overflow: 'hidden'
        }}>
          <Zoom in={true} timeout={600}>
            <Card sx={{ 
              maxWidth: 450, 
              width: '90%',
              bgcolor: 'white',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              borderRadius: 2
            }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Zoom in={true} timeout={800} style={{ transitionDelay: '200ms' }}>
                    <Lock sx={{ fontSize: 64, color: '#2d2d2d', mb: 2 }} />
                  </Zoom>
                  <Slide direction="down" in={true} timeout={600}>
                    <Box>
                      <Typography variant="h4" fontWeight={700} sx={{ color: '#2d2d2d', mb: 1 }}>
                        Meta Pixel Diagnostics
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Protected Test Environment
                      </Typography>
                    </Box>
                  </Slide>
                </Box>
                
                <Divider sx={{ my: 3 }} />
                
                <Fade in={true} timeout={800} style={{ transitionDelay: '400ms' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                      This diagnostic tool is restricted to authorized personnel. Enter the access password to continue.
                    </Typography>
                    
                    <TextField
                      fullWidth
                      type={showPassword ? 'text' : 'password'}
                      label="Access Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                      error={!!passwordError}
                      helperText={passwordError}
                      sx={{ mb: 3 }}
                      autoFocus
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                              sx={{ color: '#2d2d2d' }}
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      onClick={handlePasswordSubmit}
                      sx={{
                        bgcolor: '#2d2d2d',
                        '&:hover': { bgcolor: '#1a1a1a' },
                        py: 1.5,
                        fontWeight: 600
                      }}
                    >
                      Unlock Dashboard
                    </Button>
                  </Box>
                </Fade>
              </CardContent>
            </Card>
          </Zoom>
        </Box>
      </Fade>
    );
  }
  
  // Show full-page loader during test
  if (testRunning) {
    return (
      <Box sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        background: 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        overflow: 'hidden',
        p: 4
      }}>
        {/* Animated Background Pattern */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.05,
          background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.05) 10px, rgba(255,255,255,.05) 20px)',
          animation: 'slide 20s linear infinite',
          '@keyframes slide': {
            '0%': { transform: 'translateX(0)' },
            '100%': { transform: 'translateX(20px)' }
          }
        }} />
        
        {/* Main Content */}
        <Zoom in={true} timeout={600}>
          <Box sx={{ textAlign: 'center', zIndex: 1, maxWidth: 600, width: '100%' }}>
            {/* Animated Icon */}
            <Box sx={{ 
              mb: 4,
              position: 'relative',
              display: 'inline-block'
            }}>
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.5 },
                  '50%': { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 0 }
                }
              }} />
              <CircularProgress 
                size={80} 
                thickness={2}
                sx={{ 
                  color: 'white',
                  animation: 'spin 1s linear infinite',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' }
                  }
                }} 
              />
            </Box>
            
            {/* Title */}
            <Fade in={true} timeout={800}>
              <Typography 
                variant="h3" 
                fontWeight={800} 
                sx={{ 
                  color: 'white', 
                  mb: 2,
                  textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                }}
              >
                Running Diagnostics
              </Typography>
            </Fade>
            
            {/* Current Stage - Large and Animated */}
            <Slide direction="up" in={!!currentStage} timeout={500}>
              <Box sx={{ mb: 3, minHeight: 50 }}>
                <Typography 
                  variant="h6" 
                  fontWeight={600}
                  sx={{ 
                    color: 'rgba(255,255,255,0.95)',
                    mb: 0.5,
                    textShadow: '0 1px 5px rgba(0,0,0,0.2)'
                  }}
                >
                  {currentStage || ' '}
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.85rem'
                  }}
                >
                  {currentTestStep}
                </Typography>
              </Box>
            </Slide>
            
            {/* Progress Bar */}
            <Fade in={true} timeout={1000} style={{ transitionDelay: '200ms' }}>
              <Box sx={{ width: '100%', mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={testProgress}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'rgba(255,255,255,0.2)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: 'white',
                      borderRadius: 4,
                      boxShadow: '0 0 10px rgba(255,255,255,0.5)'
                    }
                  }}
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.7)', 
                    mt: 1,
                    display: 'block'
                  }}
                >
                  {testProgress}% Complete
                </Typography>
              </Box>
            </Fade>
            
            {/* Event Progress Indicators */}
            <Fade in={true} timeout={800} style={{ transitionDelay: '400ms' }}>
              <Stack 
                direction="row" 
                spacing={2} 
                justifyContent="center" 
                flexWrap="wrap"
                sx={{ mt: 4, gap: 1 }}
              >
                {TEST_EVENTS.map((event, index) => {
                  const eventResult = testResults.find(r => r.eventName === event.name);
                  const isCompleted = !!eventResult;
                  const isSuccess = eventResult?.pixelFired && eventResult?.capiFired;
                  
                  return (
                    <Zoom 
                      key={event.name} 
                      in={true} 
                      timeout={400}
                      style={{ transitionDelay: `${index * 100}ms` }}
                    >
                      <Chip
                        icon={React.createElement(event.icon, { 
                          sx: { 
                            color: isCompleted ? (isSuccess ? '#10b981' : '#ef4444') : 'rgba(255,255,255,0.5)' 
                          } 
                        })}
                        label={event.name}
                        sx={{
                          bgcolor: isCompleted 
                            ? (isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)') 
                            : 'rgba(255,255,255,0.1)',
                          color: isCompleted 
                            ? (isSuccess ? '#10b981' : '#ef4444') 
                            : 'rgba(255,255,255,0.7)',
                          fontWeight: 600,
                          border: `1px solid ${isCompleted ? (isSuccess ? '#10b981' : '#ef4444') : 'rgba(255,255,255,0.2)'}`,
                          transition: 'all 0.3s ease'
                        }}
                      />
                    </Zoom>
                  );
                })}
              </Stack>
            </Fade>
          </Box>
        </Zoom>
      </Box>
    );
  }
  
  // Main dashboard view
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa', py: 4 }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#2d2d2d' }}>
              Meta Pixel Diagnostics
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Comprehensive tracking validation for marketing and technical teams
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Tooltip title="Session expires in 1 hour">
              <Chip
                icon={<LockOpen />}
                label="Authenticated"
                color="success"
                variant="outlined"
              />
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={runFullTest}
              sx={{
                bgcolor: '#2d2d2d',
                '&:hover': { bgcolor: '#1a1a1a' }
              }}
            >
              Re-run Test
            </Button>
          </Stack>
        </Box>
        
        {/* IP Detection Banner */}
        <Card sx={{ mb: 3, border: clientIP ? '2px solid #10b981' : '2px solid #f59e0b', bgcolor: clientIP ? '#f0fdf4' : '#fffbeb' }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <NetworkCheck sx={{ fontSize: 32, color: clientIP ? '#10b981' : '#f59e0b' }} />
                  <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#2d2d2d' }}>
                      {ipDetecting ? 'Detecting IP Address...' : clientIP ? `Your IP: ${clientIP}` : 'IP Detection Failed'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {ipDetecting ? 'Please wait while we detect your IP address for accurate Meta Pixel tracking' : 
                       clientIP ? `Format: ${ipFormat} • Source: Browser API • This IP will be sent to both Pixel and CAPI` :
                       'Unable to detect IP - test will use fallback'}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  {clientIP && (
                    <Chip 
                      label={ipFormat} 
                      color={ipFormat === 'IPv4' ? 'primary' : 'secondary'}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={refreshIPDetection}
                    disabled={ipDetecting}
                    startIcon={ipDetecting ? <CircularProgress size={16} /> : <Refresh />}
                  >
                    {ipDetecting ? 'Detecting...' : 'Refresh'}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        
        {testResults.length === 0 ? (
          <Alert severity="info">
            Test will run automatically. Please wait...
          </Alert>
        ) : (
          <>
            {/* Overall Score Card */}
            <Card sx={{ mb: 3, border: '2px solid #e0e0e0' }}>
              <CardContent>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Box
                        sx={{
                          width: 120,
                          height: 120,
                          borderRadius: '50%',
                          border: `8px solid ${getScoreColor(overallScore)}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto',
                          mb: 1
                        }}
                      >
                        <Typography variant="h3" fontWeight={800} sx={{ color: '#2d2d2d' }}>
                          {overallScore}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Overall Health Score
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={9}>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f9fafb', border: '1px solid #e0e0e0' }}>
                          <Typography variant="h4" fontWeight={700} sx={{ color: '#2d2d2d' }}>
                            {overallMetrics.pixelSuccess}/{overallMetrics.totalEvents}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Pixel Events
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f9fafb', border: '1px solid #e0e0e0' }}>
                          <Typography variant="h4" fontWeight={700} sx={{ color: '#2d2d2d' }}>
                            {overallMetrics.capiSuccess}/{overallMetrics.totalEvents}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            CAPI Events
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f9fafb', border: '1px solid #e0e0e0' }}>
                          <Typography variant="h4" fontWeight={700} sx={{ color: '#2d2d2d' }}>
                            {overallMetrics.deduplicationSuccess}/{overallMetrics.totalEvents}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Deduplicated
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f9fafb', border: '1px solid #e0e0e0' }}>
                          <Typography variant="h4" fontWeight={700} sx={{ color: '#2d2d2d' }}>
                            {overallMetrics.avgMatchQuality.toFixed(1)}/10
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Avg Match Quality
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            {/* Event Results Table */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ color: '#2d2d2d', mb: 2 }}>
                  Event Test Results
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead sx={{ bgcolor: '#f9fafb' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Event</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Pixel</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>CAPI</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Deduplicated</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Match Quality</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Event ID</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {testResults.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Chip
                              label={result.eventName}
                              size="small"
                              sx={{ bgcolor: '#f3f4f6', color: '#2d2d2d', fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell align="center">{getStatusIcon(result.pixelFired)}</TableCell>
                          <TableCell align="center">{getStatusIcon(result.capiFired)}</TableCell>
                          <TableCell align="center">{getStatusIcon(result.deduplicationWorking)}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${result.matchQualityScore}/10`}
                              size="small"
                              color={result.matchQualityScore >= 7 ? 'success' : result.matchQualityScore >= 4 ? 'warning' : 'error'}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {result.eventId.substring(0, 20)}...
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
            
            {/* Detailed Analysis Accordions */}
            {testResults.map((result, index) => (
              <Accordion key={index} sx={{ mb: 1, border: '1px solid #e0e0e0' }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                    {React.createElement(TEST_EVENTS.find(e => e.name === result.eventName)?.icon || Info, {
                      sx: { color: '#2d2d2d' }
                    })}
                    <Typography fontWeight={600} sx={{ color: '#2d2d2d', flexGrow: 1 }}>
                      {result.eventName} Analysis
                    </Typography>
                    <Chip 
                      label={`${result.matchQualityScore}/10 Quality`}
                      size="small"
                      color={result.matchQualityScore >= 7 ? 'success' : result.matchQualityScore >= 4 ? 'warning' : 'error'}
                    />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {/* Event Status Summary */}
                    <Grid item xs={12}>
                      <Paper sx={{ p: 2, bgcolor: '#f9fafb', border: '1px solid #e0e0e0' }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#2d2d2d', mb: 2 }}>
                          Event Status
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={4}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              {result.pixelFired ? <CheckCircle sx={{ color: '#10b981' }} /> : <Cancel sx={{ color: '#ef4444' }} />}
                              <Box>
                                <Typography variant="body2" fontWeight={600}>Pixel Fired</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {result.pixelFired ? 'Successfully sent to Facebook' : 'Failed to fire'}
                                </Typography>
                              </Box>
                            </Stack>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              {result.capiFired ? <CheckCircle sx={{ color: '#10b981' }} /> : <Cancel sx={{ color: '#ef4444' }} />}
                              <Box>
                                <Typography variant="body2" fontWeight={600}>CAPI Received</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {result.capiFired ? 'Server confirmed receipt' : 'Server did not receive'}
                                </Typography>
                              </Box>
                            </Stack>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              {result.deduplicationWorking ? <CheckCircle sx={{ color: '#10b981' }} /> : <Cancel sx={{ color: '#ef4444' }} />}
                              <Box>
                                <Typography variant="body2" fontWeight={600}>Event ID Matched</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {result.deduplicationWorking ? 'Same ID used for both' : 'IDs do not match'}
                                </Typography>
                              </Box>
                            </Stack>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {/* Match Quality Breakdown */}
                    {result.capiData?.debug && (
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2, bgcolor: '#f9fafb', border: '1px solid #e0e0e0' }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#2d2d2d', mb: 2 }}>
                            Match Quality Score: {result.matchQualityScore}/10
                          </Typography>
                          <Stack spacing={1.5}>
                            <Box>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                <Typography variant="caption" fontWeight={600}>Email</Typography>
                                <Chip 
                                  label={result.capiData.debug.hasEmail ? '+4 pts' : 'Missing'} 
                                  size="small" 
                                  color={result.capiData.debug.hasEmail ? 'success' : 'default'}
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              </Stack>
                              <LinearProgress 
                                variant="determinate" 
                                value={result.capiData.debug.hasEmail ? 100 : 0} 
                                sx={{ 
                                  height: 6, 
                                  borderRadius: 3,
                                  bgcolor: '#e0e0e0',
                                  '& .MuiLinearProgress-bar': { bgcolor: '#10b981' }
                                }} 
                              />
                            </Box>
                            
                            <Box>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                <Typography variant="caption" fontWeight={600}>Phone</Typography>
                                <Chip 
                                  label={result.capiData.debug.hasPhone ? '+3 pts' : 'Missing'} 
                                  size="small" 
                                  color={result.capiData.debug.hasPhone ? 'success' : 'default'}
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              </Stack>
                              <LinearProgress 
                                variant="determinate" 
                                value={result.capiData.debug.hasPhone ? 100 : 0} 
                                sx={{ 
                                  height: 6, 
                                  borderRadius: 3,
                                  bgcolor: '#e0e0e0',
                                  '& .MuiLinearProgress-bar': { bgcolor: '#10b981' }
                                }} 
                              />
                            </Box>
                            
                            <Box>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                <Typography variant="caption" fontWeight={600}>Facebook Click Cookie (_fbc)</Typography>
                                <Chip 
                                  label={result.capiData.debug.hasFbc ? '+2 pts' : 'Missing'} 
                                  size="small" 
                                  color={result.capiData.debug.hasFbc ? 'success' : 'default'}
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              </Stack>
                              <LinearProgress 
                                variant="determinate" 
                                value={result.capiData.debug.hasFbc ? 100 : 0} 
                                sx={{ 
                                  height: 6, 
                                  borderRadius: 3,
                                  bgcolor: '#e0e0e0',
                                  '& .MuiLinearProgress-bar': { bgcolor: '#10b981' }
                                }} 
                              />
                            </Box>
                            
                            <Box>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                <Typography variant="caption" fontWeight={600}>Facebook Browser Cookie (_fbp)</Typography>
                                <Chip 
                                  label={result.capiData.debug.hasFbp ? '+1 pt' : 'Missing'} 
                                  size="small" 
                                  color={result.capiData.debug.hasFbp ? 'success' : 'default'}
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              </Stack>
                              <LinearProgress 
                                variant="determinate" 
                                value={result.capiData.debug.hasFbp ? 100 : 0} 
                                sx={{ 
                                  height: 6, 
                                  borderRadius: 3,
                                  bgcolor: '#e0e0e0',
                                  '& .MuiLinearProgress-bar': { bgcolor: '#10b981' }
                                }} 
                              />
                            </Box>
                            
                            <Box>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                <Typography variant="caption" fontWeight={600}>External ID</Typography>
                                <Chip 
                                  label={result.capiData.debug.hasExternalId ? '+1 pt' : 'Missing'} 
                                  size="small" 
                                  color={result.capiData.debug.hasExternalId ? 'success' : 'default'}
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              </Stack>
                              <LinearProgress 
                                variant="determinate" 
                                value={result.capiData.debug.hasExternalId ? 100 : 0} 
                                sx={{ 
                                  height: 6, 
                                  borderRadius: 3,
                                  bgcolor: '#e0e0e0',
                                  '& .MuiLinearProgress-bar': { bgcolor: '#10b981' }
                                }} 
                              />
                            </Box>
                          </Stack>
                          
                          <Alert severity={result.matchQualityScore >= 7 ? 'success' : result.matchQualityScore >= 4 ? 'warning' : 'error'} sx={{ mt: 2 }}>
                            <Typography variant="caption">
                              {result.matchQualityScore >= 7 && `Excellent! High quality match for accurate attribution.`}
                              {result.matchQualityScore >= 4 && result.matchQualityScore < 7 && `Good match quality. ${!result.capiData.debug.hasEmail && !result.capiData.debug.hasPhone ? 'Note: This event type does not send email/phone in production.' : 'Consider improving user data collection.'}`}
                              {result.matchQualityScore < 4 && `Low match quality. ${!TEST_EVENTS.find(e => e.name === result.eventName)?.includeUserData ? 'This is expected - ' + result.eventName + ' only sends cookies & external_id in production.' : 'Add email, phone, and Facebook cookies to improve tracking.'}`}
                            </Typography>
                          </Alert>
                          
                          {!TEST_EVENTS.find(e => e.name === result.eventName)?.includeUserData && (
                            <Alert severity="info" sx={{ mt: 1 }}>
                              <Typography variant="caption" fontWeight={600}>
                                Production Behavior: {result.eventName} does NOT send email/phone
                              </Typography>
                              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                Match quality for {result.eventName} relies on cookies and external_id only. This is the expected behavior in production to reduce data transfer and improve performance for non-critical events.
                              </Typography>
                            </Alert>
                          )}
                        </Paper>
                      </Grid>
                    )}

                    {/* Event Data Sent */}
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 2, bgcolor: '#f9fafb', border: '1px solid #e0e0e0' }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#2d2d2d', mb: 2 }}>
                          Event Data
                        </Typography>
                        <Stack spacing={1}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>Event ID:</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                              {result.eventId}
                            </Typography>
                          </Box>
                          {result.pixelData?.value && (
                            <Box>
                              <Typography variant="caption" color="text.secondary" fontWeight={600}>Value:</Typography>
                              <Typography variant="body2">
                                ₹{result.pixelData.value}
                              </Typography>
                            </Box>
                          )}
                          {result.pixelData?.content_name && (
                            <Box>
                              <Typography variant="caption" color="text.secondary" fontWeight={600}>Product:</Typography>
                              <Typography variant="body2">
                                {result.pixelData.content_name}
                              </Typography>
                            </Box>
                          )}
                          {result.pixelData?.contents && result.pixelData.contents.length > 0 && (
                            <Box>
                              <Typography variant="caption" color="text.secondary" fontWeight={600}>Items:</Typography>
                              <Typography variant="body2">
                                {result.pixelData.contents.length} item(s)
                              </Typography>
                            </Box>
                          )}
                          <Divider sx={{ my: 1 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>Timestamp:</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {new Date(result.timestamp).toLocaleString()}
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    </Grid>
                    
                    {/* User Data Sent */}
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 2, bgcolor: '#f9fafb', border: '1px solid #e0e0e0' }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#2d2d2d', mb: 1.5 }}>
                          User Data Sent
                        </Typography>
                        
                        {/* Show warning if event doesn't send user data in production */}
                        {!TEST_EVENTS.find(e => e.name === result.eventName)?.includeUserData && (
                          <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }}>
                            <Typography variant="caption">
                              In production, {result.eventName} does NOT send email/phone data (only cookies & external_id)
                            </Typography>
                          </Alert>
                        )}
                        
                        <Stack spacing={0.5}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {result.capiData?.debug?.hasEmail ? <CheckCircle sx={{ fontSize: 16, color: '#10b981' }} /> : <Cancel sx={{ fontSize: 16, color: '#ef4444' }} />}
                            <Typography variant="caption">Email (test.user@example.com)</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {result.capiData?.debug?.hasPhone ? <CheckCircle sx={{ fontSize: 16, color: '#10b981' }} /> : <Cancel sx={{ fontSize: 16, color: '#ef4444' }} />}
                            <Typography variant="caption">Phone (9876543210)</Typography>
                          </Box>
                          
                          <Divider sx={{ my: 1 }} />
                          
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mt: 1 }}>
                            Always Sent (All Events):
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {result.capiData?.debug?.hasExternalId ? <CheckCircle sx={{ fontSize: 16, color: '#10b981' }} /> : <Cancel sx={{ fontSize: 16, color: '#ef4444' }} />}
                            <Typography variant="caption">External ID (test-user-123)</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {result.capiData?.debug?.hasFbp ? <CheckCircle sx={{ fontSize: 16, color: '#10b981' }} /> : <Cancel sx={{ fontSize: 16, color: '#ef4444' }} />}
                            <Typography variant="caption">_fbp Cookie</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {result.capiData?.debug?.hasFbc ? <CheckCircle sx={{ fontSize: 16, color: '#10b981' }} /> : <Cancel sx={{ fontSize: 16, color: '#ef4444' }} />}
                            <Typography variant="caption">_fbc Cookie</Typography>
                          </Box>
                          
                          <Alert severity={result.importance === 'critical' ? 'warning' : 'info'} sx={{ mt: 1.5, py: 0.5 }}>
                            <Typography variant="caption">
                              {result.importance === 'critical' && '⚠️ CRITICAL: '}
                              {result.importance === 'high' && 'HIGH: '}
                              {result.importance === 'optional' && 'OPTIONAL: '}
                              {result.importance === 'critical' && 'This event is critical for conversion tracking and requires high match quality.'}
                              {result.importance === 'high' && 'This event is important for remarketing and optimization.'}
                              {result.importance === 'optional' && 'This event provides context but is not critical for attribution.'}
                            </Typography>
                          </Alert>
                        </Stack>
                      </Paper>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </>
        )}
      </Container>
    </Box>
  );
}
