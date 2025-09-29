'use client';
import React from 'react';
import SupportChatLauncher from './SupportChatLauncher';

// Launcher only – session context now provided globally in layout
export default function SupportChatProvider() {
  return <SupportChatLauncher />;
}
