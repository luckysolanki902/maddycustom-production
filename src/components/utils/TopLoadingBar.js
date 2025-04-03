'use client';
import NextTopLoader from 'nextjs-toploader';

const TopLoadingBar = () => {
  return (
    <NextTopLoader
      color="#424242"
      initialPosition={0.05}       // relaxed entrance position
      crawlSpeed={5}               // slower crawl for smooth progress
      height={3}                   // moderate thickness for visibility
      easing="ease-in-out"         // gentle acceleration/deceleration
      speed={200}                  // slower overall speed for a smooth feel
      shadow="0 0 8px rgba(255,255,255,0.5)"  // subtle white shadow
      zIndex={1600}
      showAtBottom={false}
    />
  );
};

export default TopLoadingBar;
