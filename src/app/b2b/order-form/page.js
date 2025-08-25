// Redirect user back to /b2b and open dialog (client component)
'use client';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setDialogOpen } from '@/store/slices/b2bFormSlice';
import { useRouter } from 'next/navigation';

export default function LegacyB2BOrderFormRedirect() {
  const dispatch = useDispatch();
  const router = useRouter();
  useEffect(() => {
    dispatch(setDialogOpen(true));
    router.replace('/b2b');
  }, [dispatch, router]);
  return null;
}
