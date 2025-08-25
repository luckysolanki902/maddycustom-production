import React from 'react';
import { fetchSearchCategories, fetchDisplayAssets } from '@/lib/utils/fetchutils';
import CategoryGrid from '@/components/page-sections/homepage/CategoryGrid';

export const metadata = { title: 'B2B Bulk Purchase | MaddyCustom' };

export default async function B2BHomePage() {
  // Fetch display assets to reuse existing category grid assets
  const displayAssetsData = await fetchDisplayAssets('homepage');
  const { assets = [] } = displayAssetsData;

  return (
    <main style={{ padding: '0px 24px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 600, color: '#2d2d2d', marginBottom: 6 }}>B2B Bulk Request</h1>
        <p style={{ color: '#555', fontSize: 14 }}>Browse categories and enter the quantities you require. Submit the request — our team will respond with pricing & next steps.</p>
      </header>
      <CategoryGrid assets={assets} title="Select a Category" b2bMode />
    </main>
  );
}
