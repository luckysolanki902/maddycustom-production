'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Pagination } from '@mui/material';
import { PaginationStyles, PaginationStylesForPhone } from '@/styles/PaginationStyles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Link from 'next/link';

export default function B2BPagination({ currentPage, totalPages, slugArray }) {
  const isXs = useMediaQuery('(max-width:480px)');
  const isSm = useMediaQuery('(max-width:760px)');
  const Wrapper = isSm ? PaginationStylesForPhone : PaginationStyles;
  const base = '/b2b/' + (Array.isArray(slugArray) ? slugArray.join('/') : slugArray);

  const siblingCount = isXs ? 0 : 1;
  const boundaryCount = isXs ? 1 : 1;

  return (
    <div style={{ display:'flex', justifyContent:'center', marginTop:48 }} aria-label="Pagination Navigation">
      <Wrapper style={{
        backdropFilter:'blur(8px)',
        background:'rgba(255,255,255,0.9)',
        border:'1px solid #e2e5e9',
        borderRadius:40,
        padding: isSm ? '6px 12px' : '8px 18px',
        boxShadow:'0 8px 30px -10px rgba(0,0,0,0.15)',
        display:'flex',
        alignItems:'center'
      }}>
        <Pagination
          count={totalPages}
          page={currentPage}
          hidePrevButton hideNextButton
          size={isXs ? 'small' : 'medium'}
          siblingCount={siblingCount}
          boundaryCount={boundaryCount}
          renderItem={(item) => {
            const p = item.page;
            const href = `${base}?page=${p}`;
            if (item.type !== 'page') return null;
            const active = item.selected;
            return (
              <Link key={p} href={href} legacyBehavior prefetch>
                <a aria-label={`Page ${p}`} style={{textDecoration:'none'}}>
                  <motion.div whileHover={{y:-2}} whileTap={{scale:0.9}} animate={active?{backgroundColor:'#2d2d2d', color:'#fff'}:{backgroundColor:'#f2f3f5', color:'#2d2d2d'}} transition={{type:'spring', stiffness:300, damping:20}} style={{
                    minWidth:isXs?34:40,
                    height:isXs?34:40,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:13,fontWeight:600,
                    borderRadius:30,
                    padding:'0 4px',
                    boxShadow: active ? '0 4px 12px -4px rgba(0,0,0,0.35)' : '0 2px 6px -3px rgba(0,0,0,0.12)'
                  }}>
                    {p}
                  </motion.div>
                </a>
              </Link>
            );
          }}
        />
      </Wrapper>
    </div>
  );
}
