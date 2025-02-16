import React from 'react';
import Image from 'next/image';
import { Box, Card, CardMedia, CardContent, Typography } from '@mui/material';
import Link from 'next/link';

const PurchasedProductSlider = ({ items, baseImageUrl }) => (
  <Box sx={{padding:'1rem'}}>
    <Typography variant="h5" gutterBottom>
      Products
    </Typography>
    <Box
      sx={{
        display: 'flex',
        overflowX: 'auto',
        paddingBottom: 2,
        '&::-webkit-scrollbar': {
          height: '8px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: '#ccc',
          borderRadius: '4px',
        },
      }}
    >
      {items.map((item) => (
        <Box
          key={item.product._id}
          sx={{
            flex: '0 0 auto',
            width: 300,
            marginRight: 2,
          }}
        >
          <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <CardMedia
              component="div"
              sx={{
                width: '100%',
                height: 160,
                position: 'relative',
              }}
            >
              <Image
                src={`${baseImageUrl}${item.product.images[0]?.startsWith('/') ? item.product.images[0] : '/' + item.product.images[0]}`}
                alt={item.name}
                layout="fill"
                objectFit="cover"
              />
            </CardMedia>
            <CardContent sx={{ flex: '1 0 auto' }}>
              <Typography component="div" variant="h6">
                <Link href={`/shop/${item.product.pageSlug}`} legacyBehavior>
                  <a style={{ textDecoration: 'none', color: 'inherit' }}>{item.name}</a>
                </Link>
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                SKU: {item.sku}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Quantity: {item.quantity}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Price: ₹{item.priceAtPurchase}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  </Box>
);

export default PurchasedProductSlider;
