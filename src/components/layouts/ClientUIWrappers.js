'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import FloatingActionBar from '@/components/utils/FloatingActionButton';
import TimeTracker from '@/components/utils/userBehavior/TimeTracker';
import SubscribeDialog from '@/components/dialogs/SubscribeDialog';
import PathnameTracker from '@/components/utils/userBehavior/PathnameTracker';
import ScrollChecker from '@/components/utils/userBehavior/ScrollChecker';

export default function ClientUIWrappers(){
  const pathname = usePathname();
  const isB2B = pathname?.startsWith('/b2b');
  return (
    <>
      {!isB2B && <FloatingActionBar />}
      {!isB2B && <TimeTracker />}
      {!isB2B && <SubscribeDialog />}
      <PathnameTracker />
      <ScrollChecker />
    </>
  );
}
