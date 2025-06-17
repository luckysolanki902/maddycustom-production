'use client';

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useSession } from "next-auth/react";
import { setUserDetails, setUserExists, setLoginDialogShown } from "../../store/slices/orderFormSlice";

// Session Provider Wrapper
export function AuthProvider({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}

// Session Sync Component
export function SessionSync() {
  const { data: session } = useSession();
  const dispatch = useDispatch();
  
  useEffect(() => {
    if (session?.user) {
      dispatch(setUserExists(true));
      dispatch(setUserDetails({
        phoneNumber: session.user.phoneNumber, 
        name: session.user.name || null,
        userId: session.user.id // MongoDB _id
      }));
      dispatch(setLoginDialogShown(true));
    }
  }, [session, dispatch]);
  
  return null;
}