'use client';
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  LinearProgress,
  Chip,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  AlertTitle,
  Divider,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Refresh,
  ExpandMore,
  TrendingUp,
  Security,
  NetworkCheck,
  Cookie,
  Link as LinkIcon,
  Speed,
  Analytics,
  Code,
  BugReport,
  Info
} from '@mui/icons-material';

export default function MetaPixelHealthCheck() {
  const hasRunHealthCheck = useRef(false); // Prevent double-run in development
  const [healthScore, setHealthScore] = useState(0);
  const [checks, setChecks] = useState({
    pixelLoaded: { status: 'checking', score: 0, message: '', details: {} },
    capiWorking: { status: 'checking', score: 0, message: '', details: {} },
    ipExtraction: { status: 'checking', score: 0, message: '', details: {} },
    deduplication: { status: 'checking', score: 0, message: '', details: {} },
    cookies: { status: 'checking', score: 0, message: '', details: {} },
    matchQuality: { status: 'checking', score: 0, message: '', details: {} }
  });
  const [pixelEvents, setPixelEvents] = useState([]);
  const [capiEvents, setCapiEvents] = useState([]);
  const [coverage, setCoverage] = useState({ percentage: 0, covered: 0, total: 0 });
  const [publicIp, setPublicIp] = useState('');
  const [testInProgress, setTestInProgress] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [detailedAnalysis, setDetailedAnalysis] = useState({});
  const [lastTestResponse, setLastTestResponse] = useState(null);
  const [environment, setEnvironment] = useState({
    type: 'unknown',
    hostname: '',
    isProduction: false,
    isLocalhost: false,
    hasAdClick: false,
    urlParams: {}
  });

  // Intercept Facebook Pixel events
  useEffect(() => {
    // Detect environment
    const hostname = window.location.hostname;
    const searchParams = new URLSearchParams(window.location.search);
    const urlParams = {};
    searchParams.forEach((value, key) => {
      urlParams[key] = value;
    });
    
    setEnvironment({
      type: hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost' 
            : hostname.includes('maddycustom.com') ? 'production' 
            : 'other',
      hostname,
      isProduction: hostname.includes('maddycustom.com'),
      isLocalhost: hostname === 'localhost' || hostname === '127.0.0.1',
      hasAdClick: urlParams.fbclid || document.cookie.includes('_fbc'),
      urlParams
    });

    // Track seen event IDs to prevent duplicates in the UI
    const seenPixelEventIds = new Set();
    const seenCapiEventIds = new Set();

    // Intercept Pixel events
    if (typeof window.fbq !== 'undefined') {
      const originalFbq = window.fbq;
      window.fbq = function(...args) {
        if (args[0] === 'track' || args[0] === 'trackCustom') {
          const eventName = args[1];
          const eventData = args[2] || {};
          const options = args[3] || {}; // Options object contains eventID
          
          // Extract eventID from options object (args[3]) - this is where fbq passes it
          // Signature: fbq(command, eventName, parameters, options)
          let eventId = options.eventID || eventData.eventID || null;
          
          if (!eventId && eventName === 'PageView') {
            eventId = 'Auto (No ID)'; // Only if truly missing
          } else if (!eventId) {
            eventId = 'N/A';
          }
          
          // Create a unique key for deduplication (event + ID + time bucket)
          const timeBucket = Math.floor(Date.now() / 1000); // 1-second buckets
          const dedupeKey = `${eventName}-${eventId}-${timeBucket}`;
          
          // Only add if we haven't seen this exact event in the last second
          if (!seenPixelEventIds.has(dedupeKey)) {
            seenPixelEventIds.add(dedupeKey);
            
            // Clean up old entries after 5 seconds
            setTimeout(() => seenPixelEventIds.delete(dedupeKey), 5000);
            
            setPixelEvents(prev => [...prev, {
              event: eventName,
              time: new Date().toLocaleTimeString(),
              eventId: eventId,
              data: eventData
            }]);
          }
        }
        return originalFbq.apply(this, args);
      };
    }

    // Intercept CAPI fetch calls to track all CAPI events
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = args[0];
      
      // Check if this is a CAPI call
      if (typeof url === 'string' && url.includes('/api/meta/conversion-api')) {
        try {
          // Call original fetch
          const response = await originalFetch.apply(this, args);
          
          // Clone response so we can read it without consuming it
          const clonedResponse = response.clone();
          
          // Try to parse the request body to get eventID
          try {
            const requestBody = JSON.parse(args[1]?.body || '{}');
            const eventName = requestBody.eventName;
            const eventId = requestBody.options?.eventID;
            
            if (eventId) {
              const timeBucket = Math.floor(Date.now() / 1000);
              const dedupeKey = `${eventName}-${eventId}-${timeBucket}`;
              
              // Parse response to check if successful
              const responseData = await clonedResponse.json();
              const success = responseData.message === 'Event sent successfully';
              
              if (!seenCapiEventIds.has(dedupeKey)) {
                seenCapiEventIds.add(dedupeKey);
                setTimeout(() => seenCapiEventIds.delete(dedupeKey), 5000);
                
                console.log('[CAPI Interceptor] Captured:', { eventName, eventId, success });
                
                setCapiEvents(prev => {
                  const exists = prev.some(e => e.eventId === eventId);
                  if (exists) return prev;
                  
                  return [...prev, {
                    eventName,
                    timestamp: Date.now(),
                    eventId,
                    matchQualityScore: responseData.debug?.matchQualityScore || 0,
                    success,
                    matched: true
                  }];
                });
              }
            }
          } catch (parseError) {
            console.warn('[CAPI Interceptor] Failed to parse:', parseError);
          }
          
          return response;
        } catch (error) {
          console.error('[CAPI Interceptor] Error:', error);
          throw error;
        }
      }
      
      // Not a CAPI call, use original fetch
      return originalFetch.apply(this, args);
    };

    // Cleanup function to restore original fetch
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Run health checks on mount
  useEffect(() => {
    // Prevent double-run in React StrictMode (development)
    if (hasRunHealthCheck.current) return;
    hasRunHealthCheck.current = true;
    
    runAllHealthChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCheck = (checkName, status, score, message, details = {}) => {
    setChecks(prev => ({
      ...prev,
      [checkName]: { status, score, message, details }
    }));
  };

  const calculateHealthScore = (checksObj) => {
    const total = Object.values(checksObj).reduce((sum, check) => sum + check.score, 0);
    const max = Object.keys(checksObj).length * 100;
    return Math.round((total / max) * 100);
  };

  const generateRecommendations = (checksData, analysisData) => {
    const recs = [];
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isProduction = typeof window !== 'undefined' && 
      window.location.hostname.includes('maddycustom.com');
    const hasAdClick = typeof window !== 'undefined' && 
      (window.location.search.includes('fbclid') || document.cookie.includes('_fbc'));

    // Cookie recommendations - context-aware
    const hasFbp = checksData.cookies.details._fbp !== 'missing';
    const hasFbc = checksData.cookies.details._fbc !== 'missing';
    const hasExtId = checksData.cookies.details.mc_external_id !== 'missing';

    if (!hasFbp && !isLocalhost) {
      recs.push({
        severity: 'high',
        title: 'Missing _fbp Cookie',
        description: 'Facebook Pixel browser cookie is not set. This is required for proper attribution.',
        action: 'Ensure Facebook Pixel is loaded and firing on initial page load (not just on events).'
      });
    }

    if (!hasFbc && hasAdClick && isProduction) {
      recs.push({
        severity: 'medium',
        title: '_fbc Cookie Not Captured',
        description: 'You arrived from a Facebook ad (fbclid in URL), but _fbc cookie was not set.',
        action: 'Check that your cookie utility is capturing fbclid parameter on page load.'
      });
    } else if (!hasFbc && !hasAdClick) {
      recs.push({
        severity: 'info',
        title: '_fbc Cookie Missing (Expected)',
        description: 'The _fbc cookie is only set when users click Facebook/Instagram ads. Since you didn\'t arrive from an ad, this is normal.',
        action: 'No action needed. This cookie will be present for 30-40% of your traffic (those from ads).'
      });
    }

    if (!hasExtId) {
      recs.push({
        severity: 'medium',
        title: 'Missing External ID',
        description: 'Custom external_id cookie is not set. This helps with cross-device tracking.',
        action: 'Ensure external_id is generated and stored on first page visit.'
      });
    }

    // Match quality - context-aware scoring
    const matchScore = analysisData.matchScore || 0;
    
    if (matchScore < 3) {
      recs.push({
        severity: isLocalhost ? 'info' : 'high',
        title: isLocalhost ? 'Low Match Quality (Expected for Testing)' : 'Low Match Quality Score',
        description: isLocalhost 
          ? `Current score: ${matchScore}/10. This is expected on localhost without real user data.`
          : `Current score: ${matchScore}/10. Low scores affect ad performance and attribution accuracy.`,
        action: isLocalhost
          ? 'In production, add user email/phone (hashed) at checkout to achieve 7-8/10 score.'
          : 'Add user email/phone data to Purchase and InitiateCheckout events. Hash using SHA-256 before sending.'
      });
    } else if (matchScore < 6 && isProduction) {
      recs.push({
        severity: 'medium',
        title: 'Match Quality Can Be Improved',
        description: `Current score: ${matchScore}/10. You have basic tracking, but adding more identifiers will improve ad performance.`,
        action: 'Add email/phone at checkout, ensure all cookies are set, consider adding name/address data.'
      });
    } else if (matchScore >= 8) {
      recs.push({
        severity: 'info',
        title: 'Excellent Match Quality! 🎉',
        description: `Current score: ${matchScore}/10. Your tracking setup is optimal.`,
        action: 'Keep monitoring. Consider A/B testing to further optimize conversion rates.'
      });
    }

    // CAPI Coverage - context-aware
    if (coverage.percentage < 50 && pixelEvents.length > 3 && isProduction) {
      recs.push({
        severity: 'medium',
        title: 'Low CAPI Coverage',
        description: `Only ${coverage.percentage}% of Pixel events are backed by CAPI. This reduces reliability if Pixel is blocked.`,
        action: 'Ensure critical events (Purchase, InitiateCheckout, AddToCart) are sent to both Pixel and CAPI with matching event IDs.'
      });
    } else if (coverage.percentage < 50 && isLocalhost) {
      recs.push({
        severity: 'info',
        title: 'Low CAPI Coverage (Expected in Testing)',
        description: `Only ${coverage.percentage}% of events have CAPI backup. This is normal on this test page.`,
        action: 'In production, your conversion events (Purchase, Checkout) should have 80%+ CAPI coverage.'
      });
    }

    // IP extraction - localhost vs production
    if (checksData.ipExtraction.status === 'pass' && isLocalhost) {
      recs.push({
        severity: 'info',
        title: 'Testing on Localhost',
        description: 'Server logs show ::1 (localhost IP). This is correct for local testing.',
        action: 'In production on maddycustom.com, you will see real user IPs like ' + (publicIp || '106.219.208.162')
      });
    }

    // Deduplication issues
    if (checksData.deduplication.score < 100) {
      recs.push({
        severity: 'high',
        title: 'Event Deduplication Issue',
        description: 'Event IDs are not matching between Pixel and CAPI. This causes double-counting.',
        action: 'Ensure both fbq() and CAPI API call use the SAME eventID for the same event (e.g., order ID for Purchase).'
      });
    }

    // Success cases
    if (checksData.pixelLoaded.status === 'pass' && 
        checksData.capiWorking.status === 'pass' && 
        checksData.deduplication.status === 'pass' &&
        hasFbp && hasExtId) {
      recs.push({
        severity: 'info',
        title: '✅ Core Setup is Excellent!',
        description: 'Pixel is loaded, CAPI is working, deduplication is functioning, and key cookies are set.',
        action: 'Your foundation is solid. Focus on adding email/phone to boost match quality to 8+/10.'
      });
    }

    return recs;
  };

  const runAllHealthChecks = async () => {
    setTestInProgress(true);
    
    // Clear previous test data to avoid confusion
    setPixelEvents([]);
    setCapiEvents([]);
    setCoverage({ percentage: 0, covered: 0, total: 0 });
    
    console.log('[Health Check] Starting fresh test run...');
    
    const analysis = {};
    
    // Check 1: Facebook Pixel Loaded
    await new Promise(resolve => setTimeout(resolve, 500));
    const pixelLoaded = typeof window.fbq !== 'undefined';
    const pixelVersion = window._fbq?.version || 'unknown';
    analysis.pixelLoaded = pixelLoaded;
    analysis.pixelVersion = pixelVersion;
    
    updateCheck('pixelLoaded', 
      pixelLoaded ? 'pass' : 'fail',
      pixelLoaded ? 100 : 0,
      pixelLoaded ? 'Facebook Pixel is loaded and active' : 'Facebook Pixel not found on page',
      { version: pixelVersion, loaded: pixelLoaded }
    );

    // Check 2: Get Public IP
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      setPublicIp(ipData.ip);
      analysis.publicIp = ipData.ip;
      analysis.ipSource = 'external';
      
      updateCheck('ipExtraction', 'pass', 100, `Using IP: ${ipData.ip}`, {
        ip: ipData.ip,
        source: 'api.ipify.org',
        type: ipData.ip.includes(':') ? 'IPv6' : 'IPv4'
      });
    } catch (err) {
      updateCheck('ipExtraction', 'fail', 0, 'Failed to fetch public IP', { error: err.message });
    }

    // Check 3: Cookies Present
    const cookies = document.cookie;
    const fbpCookie = cookies.split(';').find(c => c.includes('_fbp'));
    const fbcCookie = cookies.split(';').find(c => c.includes('_fbc'));
    const extIdCookie = cookies.split(';').find(c => c.includes('mc_external_id'));
    
    const hasFbp = !!fbpCookie;
    const hasFbc = !!fbcCookie;
    const hasExtId = !!extIdCookie;
    
    const cookieScore = (hasFbp ? 33 : 0) + (hasFbc ? 33 : 0) + (hasExtId ? 34 : 0);
    analysis.cookies = { hasFbp, hasFbc, hasExtId };
    
    updateCheck('cookies',
      cookieScore > 50 ? 'pass' : cookieScore > 0 ? 'warn' : 'fail',
      cookieScore,
      `fbp: ${hasFbp ? '✓' : '✗'}, fbc: ${hasFbc ? '✓' : '✗'}, external_id: ${hasExtId ? '✓' : '✗'}`,
      {
        _fbp: hasFbp ? fbpCookie.split('=')[1] : 'missing',
        _fbc: hasFbc ? fbcCookie.split('=')[1] : 'missing',
        mc_external_id: hasExtId ? extIdCookie.split('=')[1].substring(0, 20) + '...' : 'missing'
      }
    );

    // Check 4: Test CAPI
    try {
      const testEventId = 'health-check-' + uuidv4();
      
      // Track with Pixel first
      if (pixelLoaded) {
        window.fbq('track', 'ViewContent', {
          content_name: 'Health Check Test',
          eventID: testEventId
        });
      }
      
      // Then send to CAPI
      const capiRes = await fetch('/api/meta/conversion-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'ViewContent',
          options: {
            eventID: testEventId,
            content_name: 'Health Check Test - CAPI',
            event_source_url: window.location.href
          }
        })
      });
      
      const capiData = await capiRes.json();
      setLastTestResponse(capiData);
      const capiWorking = capiData.message === 'Event sent successfully';
      
      analysis.capiWorking = capiWorking;
      analysis.capiResponse = capiData;
      
      updateCheck('capiWorking',
        capiWorking ? 'pass' : 'fail',
        capiWorking ? 100 : 0,
        capiWorking ? 'CAPI endpoint responding correctly' : 'CAPI endpoint error',
        {
          responseTime: capiData.responseTime || 'N/A',
          eventsReceived: capiData.response?._events_received || 0,
          fbTraceId: capiData.response?._fbtrace_id || 'N/A'
        }
      );

      // Check 5: Deduplication
      const hasEventId = capiData.debug?.eventID === testEventId;
      analysis.deduplication = hasEventId;
      
      updateCheck('deduplication',
        hasEventId ? 'pass' : 'warn',
        hasEventId ? 100 : 50,
        hasEventId ? 'Event ID deduplication working' : 'Event ID not found in response',
        {
          sentEventId: testEventId,
          receivedEventId: capiData.debug?.eventID || 'N/A',
          matching: hasEventId
        }
      );

      // Check 6: Match Quality
      const matchScore = capiData.debug?.matchQualityScore || 0;
      const ipPresent = capiData.debug?.realClientIp === 'present';
      analysis.matchScore = matchScore;
      analysis.ipPresent = ipPresent;
      
      // Calculate expected score based on environment
      let expectedMinScore = 1;
      let expectedMaxScore = 3;
      
      if (typeof window !== 'undefined') {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isProduction = window.location.hostname.includes('maddycustom.com');
        const hasAdClick = window.location.search.includes('fbclid') || document.cookie.includes('_fbc');
        
        if (isLocalhost) {
          expectedMinScore = 1;
          expectedMaxScore = 3;
        } else if (isProduction && hasAdClick) {
          expectedMinScore = 8;
          expectedMaxScore = 10;
        } else if (isProduction) {
          expectedMinScore = 6;
          expectedMaxScore = 8;
        }
      }
      
      analysis.expectedScoreRange = `${expectedMinScore}-${expectedMaxScore}`;
      
      // Determine status based on context
      let matchQualityStatus = 'pass';
      if (matchScore < expectedMinScore) {
        matchQualityStatus = 'fail';
      } else if (matchScore < (expectedMinScore + expectedMaxScore) / 2) {
        matchQualityStatus = 'warn';
      }
      
      updateCheck('matchQuality',
        matchQualityStatus,
        Math.min(matchScore * 10, 100),
        `Score: ${matchScore}/10 | Expected: ${expectedMinScore}-${expectedMaxScore} | IP: ${ipPresent ? '✓' : '✗'}`,
        {
          score: matchScore,
          maxScore: 10,
          expectedRange: `${expectedMinScore}-${expectedMaxScore}`,
          ipPresent,
          fbpPresent: capiData.debug?.fbp !== 'missing',
          fbcPresent: capiData.debug?.fbc !== 'missing',
          breakdown: `IP(${ipPresent ? 1 : 0}) + FBP(${capiData.debug?.fbp !== 'missing' ? 1 : 0}) + FBC(${capiData.debug?.fbc !== 'missing' ? 1 : 0}) + ExtID(${hasExtId ? 1 : 0})`
        }
      );

      // Track CAPI event from health check
      setCapiEvents(prev => {
        // Avoid duplicates
        const exists = prev.some(e => e.eventId === testEventId);
        if (exists) return prev;
        
        return [...prev, {
          eventName: 'ViewContent',
          timestamp: Date.now(),
          eventId: testEventId,
          matchQualityScore: matchScore,
          success: capiWorking,
          matched: true // Mark as matched since we successfully got a response with this eventID
        }];
      });

    } catch (err) {
      updateCheck('capiWorking', 'fail', 0, 'CAPI test failed: ' + err.message, { error: err.message });
    }

    setDetailedAnalysis(analysis);
    setTestInProgress(false);
  };

  // Calculate coverage whenever events change
  useEffect(() => {
    if (pixelEvents.length > 0) {
      const coveredCount = pixelEvents.filter(pe => {
        const hasMatch = capiEvents.some(ce => ce.eventId === pe.eventId && ce.matched);
        console.log(`[Coverage] Pixel event ${pe.event} (${pe.eventId}): ${hasMatch ? 'MATCHED' : 'NO MATCH'}`);
        return hasMatch;
      }).length;
      const percentage = Math.round((coveredCount / pixelEvents.length) * 100);
      setCoverage({ percentage, covered: coveredCount, total: pixelEvents.length });
      console.log(`[Coverage] ${coveredCount}/${pixelEvents.length} = ${percentage}%`);
      console.log('[Coverage] CAPI Events:', capiEvents.map(ce => `${ce.eventName} (${ce.eventId}) matched=${ce.matched}`));
    }
  }, [pixelEvents, capiEvents]);

  // Update health score and recommendations
  useEffect(() => {
    const score = calculateHealthScore(checks);
    setHealthScore(score);
    setRecommendations(generateRecommendations(checks, detailedAnalysis));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checks, detailedAnalysis, coverage, pixelEvents]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'pass': return 'success';
      case 'warn': return 'warning';
      case 'fail': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'pass': return <CheckCircle color="success" />;
      case 'warn': return <Warning color="warning" />;
      case 'fail': return <ErrorIcon color="error" />;
      default: return <CircularProgress size={20} />;
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
      py: 4
    }}>
      <Container maxWidth="xl">
        
        {/* Header */}
        <Box sx={{ textAlign: 'center', color: '#2d2d2d', mb: 4 }}>
          <Typography variant="h3" fontWeight={800} gutterBottom>
            Meta Pixel Health Dashboard
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.7 }}>
            Comprehensive diagnostics for Pixel + CAPI integration
          </Typography>
        </Box>

        {/* Main Health Score Card */}
        <Card sx={{ mb: 3, boxShadow: 4, border: '1px solid #e0e0e0' }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress
                    variant="determinate"
                    value={healthScore}
                    size={160}
                    thickness={4}
                    sx={{
                      color: healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444',
                      '& .MuiCircularProgress-circle': {
                        strokeLinecap: 'round'
                      }
                    }}
                  />
                  <Box
                    sx={{
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: 0,
                      position: 'absolute',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column'
                    }}
                  >
                    <Typography variant="h2" fontWeight={800} sx={{ color: '#2d2d2d' }}>
                      {testInProgress ? '...' : healthScore}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      HEALTH SCORE
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                  {getHealthMessage(healthScore)}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={runAllHealthChecks}
                  disabled={testInProgress}
                  sx={{ 
                    mt: 2,
                    bgcolor: '#2d2d2d',
                    color: 'white',
                    '&:hover': {
                      bgcolor: '#1a1a1a'
                    },
                    '&:disabled': {
                      bgcolor: '#9ca3af',
                      color: 'white'
                    }
                  }}
                >
                  {testInProgress ? 'Running Tests...' : 'Re-run Health Check'}
                </Button>
              </Grid>

              <Grid item xs={12} md={8}>
                <Grid container spacing={2}>
                  {Object.entries(checks).map(([key, check]) => (
                    <Grid item xs={12} sm={6} key={key}>
                      <Card variant="outlined" sx={{ borderColor: '#e0e0e0' }}>
                        <CardContent>
                          <Stack direction="row" spacing={2} alignItems="center">
                            {getStatusIcon(check.status)}
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="body2" fontWeight={600} sx={{ color: '#2d2d2d' }}>
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {check.message}
                              </Typography>
                            </Box>
                            <Chip 
                              label={`${check.score}%`}
                              color={getStatusColor(check.status)}
                              size="small"
                            />
                          </Stack>
                          <LinearProgress 
                            variant="determinate" 
                            value={check.score} 
                            color={getStatusColor(check.status)}
                            sx={{ 
                              mt: 1,
                              bgcolor: '#f3f4f6',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: check.status === 'pass' ? '#10b981' : 
                                        check.status === 'warn' ? '#f59e0b' : 
                                        check.status === 'fail' ? '#ef4444' : '#9ca3af'
                              }
                            }}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Card sx={{ mb: 3, boxShadow: 4, border: '1px solid #e0e0e0' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                <BugReport sx={{ color: '#2d2d2d' }} />
                <Typography variant="h6" fontWeight={700} sx={{ color: '#2d2d2d' }}>
                  Recommendations
                </Typography>
              </Stack>
              <Stack spacing={2}>
                {recommendations.map((rec, idx) => (
                  <Alert 
                    key={idx} 
                    severity={getSeverityColor(rec.severity)}
                    icon={<Info />}
                    sx={{
                      border: '1px solid',
                      borderColor: rec.severity === 'high' ? '#fecaca' : 
                                   rec.severity === 'medium' ? '#fed7aa' : 
                                   rec.severity === 'info' ? '#e0e0e0' : '#e0e0e0'
                    }}
                  >
                    <AlertTitle>{rec.title}</AlertTitle>
                    <Typography variant="body2" gutterBottom>
                      {rec.description}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Action: {rec.action}
                    </Typography>
                  </Alert>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        <Grid container spacing={3}>
          
          {/* Environment Info Card */}
          <Grid item xs={12}>
            <Card sx={{ 
              boxShadow: 4, 
              border: '1px solid #e0e0e0',
              bgcolor: environment.isProduction ? '#f9fafb' : '#fafafa'
            }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <Info sx={{ color: '#2d2d2d' }} />
                  <Typography variant="h6" fontWeight={700} sx={{ color: '#2d2d2d' }}>
                    Environment: {environment.type === 'localhost' ? '🧪 Testing (Localhost)' : 
                                 environment.type === 'production' ? '🌐 Production (maddycustom.com)' : 
                                 '❓ Unknown'}
                  </Typography>
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white', border: '1px solid #e0e0e0' }}>
                      <Typography variant="caption" color="text.secondary">
                        Hostname
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', color: '#2d2d2d' }}>
                        {environment.hostname}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white', border: '1px solid #e0e0e0' }}>
                      <Typography variant="caption" color="text.secondary">
                        From Facebook Ad?
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#2d2d2d' }}>
                        {environment.hasAdClick ? '✅ Yes (fbclid found)' : '❌ No (Direct/Organic)'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white', border: '1px solid #e0e0e0' }}>
                      <Typography variant="caption" color="text.secondary">
                        Expected Match Quality
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#2d2d2d' }}>
                        {environment.isLocalhost ? '1-3/10' : 
                         environment.hasAdClick ? '9-10/10' : '6-8/10'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white', border: '1px solid #e0e0e0' }}>
                      <Typography variant="caption" color="text.secondary">
                        URL Parameters
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#2d2d2d' }}>
                        {Object.keys(environment.urlParams).length > 0 
                          ? Object.keys(environment.urlParams).join(', ')
                          : 'None'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
                {environment.isLocalhost && (
                  <Alert severity="info" sx={{ mt: 2, border: '1px solid #e0e0e0' }}>
                    <AlertTitle>Testing Mode</AlertTitle>
                    You&apos;re testing on localhost. Low scores and missing cookies are expected. 
                    In production, you&apos;ll see higher match quality scores and proper cookie tracking.
                  </Alert>
                )}
                {environment.isProduction && !environment.hasAdClick && (
                  <Alert severity="success" sx={{ mt: 2, border: '1px solid #d1fae5' }}>
                    <AlertTitle>Production - Direct Traffic</AlertTitle>
                    You&apos;re on production without ad tracking. This represents 60-70% of your traffic. 
                    Expected score: 6-8/10 (with email/phone at checkout).
                  </Alert>
                )}
                {environment.isProduction && environment.hasAdClick && (
                  <Alert severity="success" sx={{ mt: 2, border: '1px solid #d1fae5' }}>
                    <AlertTitle>Production - From Facebook Ad! 🎯</AlertTitle>
                    You arrived from a Facebook/Instagram ad. This is the best-case scenario. 
                    Expected score: 9-10/10 (with all data points).
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Coverage Card */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%', boxShadow: 4, border: '1px solid #e0e0e0' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <TrendingUp sx={{ color: '#2d2d2d' }} />
                  <Typography variant="h6" fontWeight={700} sx={{ color: '#2d2d2d' }}>
                    Pixel → CAPI Coverage
                  </Typography>
                </Stack>
                <Box sx={{ mb: 3 }}>
                  <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                    <Box sx={{ flexGrow: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={coverage.percentage}
                        sx={{ 
                          height: 20, 
                          borderRadius: 2,
                          bgcolor: '#f3f4f6',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: coverage.percentage >= 80 ? '#10b981' : coverage.percentage >= 50 ? '#f59e0b' : '#ef4444'
                          }
                        }}
                      />
                    </Box>
                    <Typography variant="h4" fontWeight={800} sx={{ color: '#2d2d2d' }}>
                      {coverage.percentage}%
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {coverage.covered} of {coverage.total} Pixel events backed by CAPI
                  </Typography>
                </Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="caption">
                    <strong>Coverage Calculation:</strong> This shows what percentage of Pixel events have a matching CAPI event with the same eventID.
                    <br/>
                    <strong>Note:</strong> Organic PageView events (from FacebookPageViewTracker) ARE sent to CAPI but may not be captured here if they fired before the test started.
                    The health check ViewContent events should show 100% coverage (both Pixel and CAPI with matching IDs).
                  </Typography>
                </Alert>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fafafa', border: '1px solid #e0e0e0' }}>
                      <Typography variant="h4" fontWeight={800} sx={{ color: '#2d2d2d' }}>
                        {pixelEvents.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Pixel Events
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fafafa', border: '1px solid #e0e0e0' }}>
                      <Typography variant="h4" fontWeight={800} sx={{ color: '#2d2d2d' }}>
                        {capiEvents.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        CAPI Events
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fafafa', border: '1px solid #e0e0e0' }}>
                      <Typography variant="h4" fontWeight={800} sx={{ color: '#10b981' }}>
                        {coverage.covered}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Deduplicated
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Info */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%', boxShadow: 4, border: '1px solid #e0e0e0' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <NetworkCheck sx={{ color: '#2d2d2d' }} />
                  <Typography variant="h6" fontWeight={700} sx={{ color: '#2d2d2d' }}>
                    Network Information
                  </Typography>
                </Stack>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <Security sx={{ color: '#2d2d2d' }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Your Public IP"
                      secondary={publicIp || 'Loading...'}
                      secondaryTypographyProps={{ 
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: '1.1rem',
                        color: '#2d2d2d'
                      }}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <Analytics sx={{ color: '#2d2d2d' }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Browser"
                      secondary={navigator.userAgent.split(' ').pop()}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <Code sx={{ color: '#2d2d2d' }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Test Mode"
                      secondary="Events use health-check- prefix (safe for production)"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Detailed Analysis Accordions */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" fontWeight={700} sx={{ color: '#2d2d2d', mb: 2 }}>
            Detailed Analysis
          </Typography>

          {/* Pixel Analysis */}
          <Accordion sx={{ border: '1px solid #e0e0e0' }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Analytics sx={{ color: '#2d2d2d' }} />
                <Typography variant="h6" sx={{ color: '#2d2d2d' }}>Facebook Pixel Analysis</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Status</strong></TableCell>
                      <TableCell sx={{ color: '#2d2d2d' }}>{checks.pixelLoaded.details.loaded ? '✓ Loaded' : '✗ Not Loaded'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Version</strong></TableCell>
                      <TableCell sx={{ color: '#2d2d2d' }}>{checks.pixelLoaded.details.version || 'Unknown'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Events Tracked</strong></TableCell>
                      <TableCell sx={{ color: '#2d2d2d' }}>{pixelEvents.length} events</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              {pixelEvents.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#2d2d2d' }}>Recent Events:</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #e0e0e0' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#fafafa' }}>
                        <TableRow>
                          <TableCell sx={{ color: '#2d2d2d' }}>Event</TableCell>
                          <TableCell sx={{ color: '#2d2d2d' }}>Time</TableCell>
                          <TableCell sx={{ color: '#2d2d2d' }}>Event ID</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pixelEvents.slice(0, 5).map((event, idx) => (
                          <TableRow key={idx}>
                            <TableCell sx={{ color: '#2d2d2d' }}>{event.event}</TableCell>
                            <TableCell sx={{ color: '#2d2d2d' }}>{event.time}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#2d2d2d' }}>
                              {event.eventId}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </AccordionDetails>
          </Accordion>

          {/* CAPI Analysis */}
          <Accordion sx={{ border: '1px solid #e0e0e0' }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack direction="row" spacing={2} alignItems="center">
                <NetworkCheck sx={{ color: '#2d2d2d' }} />
                <Typography variant="h6" sx={{ color: '#2d2d2d' }}>Conversions API Analysis</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Endpoint Status</strong></TableCell>
                      <TableCell>
                        <Chip 
                          label={checks.capiWorking.status === 'pass' ? 'Working' : 'Failed'}
                          color={getStatusColor(checks.capiWorking.status)}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Events Received</strong></TableCell>
                      <TableCell sx={{ color: '#2d2d2d' }}>{checks.capiWorking.details.eventsReceived || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>FB Trace ID</strong></TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#2d2d2d' }}>
                        {checks.capiWorking.details.fbTraceId || 'N/A'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              {lastTestResponse && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#2d2d2d' }}>Last Response:</Typography>
                  <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#e0e0e0', overflow: 'auto', border: '1px solid #e0e0e0' }}>
                    <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                      {JSON.stringify(lastTestResponse, null, 2)}
                    </pre>
                  </Paper>
                </>
              )}
            </AccordionDetails>
          </Accordion>

          {/* IP Extraction */}
          <Accordion sx={{ border: '1px solid #e0e0e0' }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Security sx={{ color: '#2d2d2d' }} />
                <Typography variant="h6" sx={{ color: '#2d2d2d' }}>IP Extraction Analysis</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Your IP</strong></TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#2d2d2d' }}>
                        {checks.ipExtraction.details.ip || 'N/A'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>IP Type</strong></TableCell>
                      <TableCell sx={{ color: '#2d2d2d' }}>{checks.ipExtraction.details.type || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Source</strong></TableCell>
                      <TableCell sx={{ color: '#2d2d2d' }}>{checks.ipExtraction.details.source || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Sent to Meta</strong></TableCell>
                      <TableCell>
                        <Chip 
                          label={checks.matchQuality.details.ipPresent ? 'Yes' : 'No'}
                          color={checks.matchQuality.details.ipPresent ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="info" sx={{ mt: 2 }}>
                <AlertTitle>Production Note</AlertTitle>
                On localhost, middleware may extract ::1 (IPv6 localhost). In production on Vercel, 
                it will extract real user IPs from x-forwarded-for headers.
              </Alert>
            </AccordionDetails>
          </Accordion>

          {/* Cookies & IDs */}
          <Accordion sx={{ border: '1px solid #e0e0e0' }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Cookie sx={{ color: '#2d2d2d' }} />
                <Typography variant="h6" sx={{ color: '#2d2d2d' }}>Cookies & Identifiers</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>_fbp (Browser)</strong></TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#2d2d2d' }}>
                        {checks.cookies.details._fbp || 'Missing'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>_fbc (Click ID)</strong></TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#2d2d2d' }}>
                        {checks.cookies.details._fbc || 'Missing'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>mc_external_id</strong></TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#2d2d2d' }}>
                        {checks.cookies.details.mc_external_id || 'Missing'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="warning" sx={{ mt: 2 }}>
                <AlertTitle>Missing _fbp / _fbc?</AlertTitle>
                These cookies are set by Facebook Pixel on initial page load. If missing, ensure:
                <List dense>
                  <ListItem>• Pixel fires on page load (not just on events)</ListItem>
                  <ListItem>• User hasn&apos;t blocked third-party cookies</ListItem>
                  <ListItem>• Domain is properly configured in Meta Events Manager</ListItem>
                </List>
              </Alert>
            </AccordionDetails>
          </Accordion>

          {/* Match Quality */}
          <Accordion sx={{ border: '1px solid #e0e0e0' }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Speed sx={{ color: '#2d2d2d' }} />
                <Typography variant="h6" sx={{ color: '#2d2d2d' }}>Match Quality Score</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ color: '#2d2d2d' }}>Current Score:</Typography>
                    <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                      <Typography variant="h3" fontWeight={800} sx={{ color: '#2d2d2d' }}>
                        {checks.matchQuality.details.score || 0}
                      </Typography>
                      <Typography variant="h6" color="text.secondary">
                        / {checks.matchQuality.details.maxScore || 10}
                      </Typography>
                    </Stack>
                    <LinearProgress 
                      variant="determinate" 
                      value={(checks.matchQuality.details.score || 0) * 10}
                      color={checks.matchQuality.details.score >= 5 ? 'success' : 'warning'}
                      sx={{ height: 10, borderRadius: 1 }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ color: '#2d2d2d' }}>Expected Range:</Typography>
                    <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                      <Typography variant="h3" fontWeight={800} sx={{ color: '#2d2d2d' }}>
                        {checks.matchQuality.details.expectedRange || '1-10'}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Based on your environment and traffic source
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" gutterBottom sx={{ color: '#2d2d2d' }}>Score Breakdown:</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', mb: 2 }}>
                {checks.matchQuality.details.breakdown || 'N/A'}
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}>IP Address</TableCell>
                      <TableCell>
                        <Chip 
                          label={checks.matchQuality.details.ipPresent ? 'Present (+1)' : 'Missing (0)'}
                          color={checks.matchQuality.details.ipPresent ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}>FBP Cookie</TableCell>
                      <TableCell>
                        <Chip 
                          label={checks.matchQuality.details.fbpPresent ? 'Present (+1)' : 'Missing (0)'}
                          color={checks.matchQuality.details.fbpPresent ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}>FBC Cookie (from ads)</TableCell>
                      <TableCell>
                        <Chip 
                          label={checks.matchQuality.details.fbcPresent ? 'Present (+2)' : 'Missing (0)'}
                          color={checks.matchQuality.details.fbcPresent ? 'success' : environment.hasAdClick ? 'error' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}>External ID</TableCell>
                      <TableCell>
                        <Chip 
                          label={checks.cookies.details.mc_external_id !== 'missing' ? 'Present (+1)' : 'Missing (0)'}
                          color={checks.cookies.details.mc_external_id !== 'missing' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: '#fafafa' }}>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Email (at checkout)</strong></TableCell>
                      <TableCell>
                        <Chip 
                          label="Not Tested (+4 potential)"
                          color="default"
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: '#fafafa' }}>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Phone (at checkout)</strong></TableCell>
                      <TableCell>
                        <Chip 
                          label="Not Tested (+3 potential)"
                          color="default"
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              
              {environment.isLocalhost ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>Testing on Localhost</AlertTitle>
                  Low scores (1-3/10) are expected here. In production with email/phone at checkout, you&apos;ll see 6-8/10 for organic traffic and 9-10/10 for ad traffic.
                </Alert>
              ) : environment.isProduction && !environment.hasAdClick ? (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <AlertTitle>Production - Organic Traffic</AlertTitle>
                  Current setup is good! To reach 7-8/10:
                  <List dense>
                    <ListItem>• Add email (hashed) at checkout → +4 points</ListItem>
                    <ListItem>• Add phone (hashed) at checkout → +3 points</ListItem>
                    <ListItem>• Ensure all cookies are set → +2 points</ListItem>
                  </List>
                </Alert>
              ) : environment.isProduction && environment.hasAdClick ? (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <AlertTitle>Production - From Facebook Ad! 🎯</AlertTitle>
                  You have the _fbc bonus! To reach 9-10/10:
                  <List dense>
                    <ListItem>• Add email (hashed) at checkout → +4 points</ListItem>
                    <ListItem>• Add phone (hashed) at checkout → +3 points</ListItem>
                    <ListItem>• Your _fbc cookie gives you +2 bonus points!</ListItem>
                  </List>
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>Improving Match Quality</AlertTitle>
                  To improve your score to 8-10/10:
                  <List dense>
                    <ListItem>• Ensure all cookies are present (_fbp, _fbc, external_id)</ListItem>
                    <ListItem>• Pass user email (hashed) in CAPI events</ListItem>
                    <ListItem>• Pass user phone (hashed) in CAPI events</ListItem>
                    <ListItem>• Verify IP extraction is working correctly</ListItem>
                  </List>
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Deduplication */}
          <Accordion sx={{ border: '1px solid #e0e0e0' }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack direction="row" spacing={2} alignItems="center">
                <LinkIcon sx={{ color: '#2d2d2d' }} />
                <Typography variant="h6" sx={{ color: '#2d2d2d' }}>Event Deduplication</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Status</strong></TableCell>
                      <TableCell>
                        <Chip 
                          label={checks.deduplication.details.matching ? 'Working' : 'Not Working'}
                          color={getStatusColor(checks.deduplication.status)}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Sent Event ID</strong></TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#2d2d2d' }}>
                        {checks.deduplication.details.sentEventId || 'N/A'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Received Event ID</strong></TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#2d2d2d' }}>
                        {checks.deduplication.details.receivedEventId || 'N/A'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2d2d2d' }}><strong>Matching</strong></TableCell>
                      <TableCell sx={{ color: '#2d2d2d' }}>
                        {checks.deduplication.details.matching ? '✓ Yes' : '✗ No'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="success" sx={{ mt: 2 }}>
                <AlertTitle>How Deduplication Works</AlertTitle>
                When the same event is sent via both Pixel (browser) and CAPI (server) with the same eventID,
                Meta automatically deduplicates them to count as a single event. This prevents double-counting
                and ensures accurate analytics.
              </Alert>
            </AccordionDetails>
          </Accordion>
        </Box>

      </Container>
    </Box>
  );
}

function getHealthMessage(score) {
  if (score >= 90) return '🎉 Excellent! Your setup is optimal';
  if (score >= 80) return '✅ Good! Minor improvements possible';
  if (score >= 60) return '⚠️ Fair - Some issues need attention';
  if (score >= 40) return '⚠️ Poor - Multiple issues detected';
  return '❌ Critical - Immediate action required';
}
