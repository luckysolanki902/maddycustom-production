import React from 'react'
import Image from 'next/image'
// mui imports for media query for isSmallScreen
import useMediaQuery from '@mui/material/useMediaQuery';

const OfferBanner = ({categoryMongoId}) => {
    const isSmallScreen = useMediaQuery('(max-width:600px)');

    const Imagemap = {
        '673aea6778c57ec01acae633': 'bw_diwali', // Bonnet wraps
        '673aea6778c57ec01acae632': 'bw_diwali', // Pillar wraps
        '689b82cd828fe7e9054ad87d': 'nr_diwali', // Neck rests
        '689b8518828fe7e9054ad87e': 'cs_diwali', // Cushions
        '689b8523828fe7e9054ad87f': 'sb_diwali', // Seat belt covers
        '689f1e2162b099ec99556d6b': 'st_diwali', // Steering covers
    };
    const imageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL + '/assets/posters/' + (Imagemap[categoryMongoId] || 'bw_diwali') + (isSmallScreen ? '_phone' : '_pc') + '.jpg';
    const altText = 'Diwali Offer'
  return (
    <div>
        <Image src={imageUrl} alt={altText} width={1000} height={1000} style={{width: '100%', height: 'auto'}} />
    </div>
  )
}

export default OfferBanner