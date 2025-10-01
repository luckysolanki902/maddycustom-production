'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import funnelClient from '@/lib/analytics/funnelClient';
import { v4 as uuidv4 } from 'uuid';
import { setUserDetails, setLocalUserId } from '@/store/slices/orderFormSlice';

const selectUtmDetails = (state) => state?.utm?.utmDetails;
const selectUtmHistory = (state) => state?.utm?.utmHistory;
const selectUserDetails = (state) => state?.orderForm?.userDetails;

function sanitizeUtm(utm) {
  if (!utm) return undefined;
  const cleaned = Object.entries(utm).reduce((acc, [key, value]) => {
    if (value === null || value === undefined) return acc;
    if (typeof value === 'string' && value.trim().length === 0) return acc;
    acc[key] = value;
    return acc;
  }, {});
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export default function FunnelClientBridge() {
  const pathname = usePathname();
  const utmDetails = useSelector(selectUtmDetails);
  const utmHistory = useSelector(selectUtmHistory);
  const userDetails = useSelector(selectUserDetails);
  const dispatch = useDispatch();
  const linkingRef = useRef({ phone: null, inFlight: false });
  const initialLoadRef = useRef(true);

  useEffect(() => {
    funnelClient.init();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const source = initialLoadRef.current ? 'landing' : 'navigation';
    funnelClient.onRouteChange(pathname, { source });
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    if (!utmDetails && !utmHistory) return;
    funnelClient.updateSession({
      utm: sanitizeUtm(utmDetails),
      utmHistory,
    });
  }, [utmDetails, utmHistory]);

  useEffect(() => {
    if (!userDetails) return;
    const hasRealUserId = Boolean(userDetails.userId && userDetails.userId.trim().length > 0);
    const hasLocalUserId = Boolean(userDetails.localUserId && userDetails.localUserId.trim().length > 0);

    if (!hasRealUserId && !hasLocalUserId) {
      dispatch(setLocalUserId(uuidv4()));
    }
  }, [dispatch, userDetails]);

  useEffect(() => {
    if (!userDetails) return;
    const identity = {};
    if (userDetails.userId) identity.userId = userDetails.userId;
    if (userDetails.phoneNumber) identity.phoneNumber = userDetails.phoneNumber;
    if (userDetails.email) identity.email = userDetails.email;
    if (userDetails.name) identity.name = userDetails.name;
    if (!userDetails.userId && userDetails.localUserId) {
      identity.localUserId = userDetails.localUserId;
    }
    if (userDetails.userId && userDetails.localUserId) {
      identity.localUserId = null;
      dispatch(setLocalUserId(''));
    }

    if (Object.keys(identity).length === 0) return;

    funnelClient.identifyUser(identity);

    if (identity.userId) {
      funnelClient.updateSession({ userId: identity.userId });
    }
  }, [dispatch, userDetails]);

  useEffect(() => {
    if (!userDetails) return;
    const phone = userDetails.phoneNumber;
    const hasUserId = Boolean(userDetails.userId);
    if (!phone || phone.trim().length === 0 || linkingRef.current.inFlight) {
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length !== 10) {
      return;
    }

    if (linkingRef.current.phone === normalizedPhone && hasUserId) {
      return;
    }

    const { visitorId, sessionId } = funnelClient.getIdentifiers();
    if (!visitorId || !sessionId) {
      return;
    }

    linkingRef.current = { phone: normalizedPhone, inFlight: true };

    const payload = {
      phoneNumber: normalizedPhone,
      name: userDetails.name || undefined,
      email: userDetails.email || undefined,
      source: 'prefill-auto-link',
      funnelVisitorId: visitorId,
      funnelSessionId: sessionId,
    };

    axios
      .post('/api/user/create', payload)
      .then((response) => {
        const data = response?.data ?? {};
        const derivedUserId = data.userId || data.user?.userId;
        if (derivedUserId && !hasUserId) {
          dispatch(setUserDetails({ userId: derivedUserId }));
        }
        linkingRef.current = { phone: normalizedPhone, inFlight: false };
      })
      .catch((error) => {
        console.error('Funnel auto-link failed:', error?.message || error);
        linkingRef.current = { phone: null, inFlight: false };
      });
  }, [dispatch, userDetails]);

  return null;
}
