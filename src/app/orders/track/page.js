import TrackPage from '@/components/full-page-comps/TrackPage';
import { createMetadata } from '@/lib/metadata/create-metadata';
import React from 'react'

export async function generateMetadata() {
  return createMetadata({
    canonical: 'https://maddycustom.com/orders/track',
  });
}

export default function page() {
  return (
    <>
      <TrackPage />
    </>
  )
}
