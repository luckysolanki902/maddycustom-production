import React from 'react';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { Container, Typography, Paper, Box, Divider, Grid, Card, Chip, Stack } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SecurityIcon from '@mui/icons-material/Security';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

export async function generateMetadata() {
    return createMetadata({
        title: 'Refund & Replacement Policy - Maddy Custom',
        canonical: 'https://www.maddycustom.com/termsandconditions',
    });
}

const Section = ({ title, children, icon }) => {
  return (
    <Card 
      elevation={0} 
      sx={{ 
        my: { xs: 2, md: 3 }, 
        p: { xs: 3, sm: 4 }, 
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        backdropFilter: 'blur(10px)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        {icon && (
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            {icon}
          </Box>
        )}
        <Typography 
          variant="h5" 
          component="h2" 
          sx={{ 
            fontWeight: 700, 
            color: '#ffffff',
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
            letterSpacing: '-0.025em'
          }}
        >
          {title}
        </Typography>
      </Stack>
      {children}
    </Card>
  );
};

const NumberedItem = ({ number, text }) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'flex-start', 
      mb: 2.5,
      '&:last-child': { mb: 0 }
    }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mr: 2,
          flexShrink: 0,
          mt: 0.25
        }}
      >
        <Typography 
          variant="body2"
          sx={{ 
            color: '#ffffff', 
            fontWeight: 700,
            fontSize: '0.875rem'
          }}
        >
          {number}
        </Typography>
      </Box>
      <Typography 
        variant="body1" 
        sx={{ 
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: { xs: '0.95rem', sm: '1rem' },
          fontWeight: 400,
          lineHeight: 1.7,
          flex: 1
        }}
      >
        {text}
      </Typography>
    </Box>
  );
};

const TermsAndConditionsPage = () => {
  return (
    <Box sx={{ 
      background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
      minHeight: '100vh', 
      py: { xs: 6, sm: 8 } 
    }}>
      <Container maxWidth="lg" sx={{ px: { xs: 3, sm: 4, md: 6 } }}>
        {/* Header */}
        <Box sx={{ mb: { xs: 6, sm: 8 }, textAlign: 'center' }}>
          <Typography 
            variant="h1" 
            component="h1" 
            sx={{ 
              fontWeight: 900, 
              color: '#ffffff',
              letterSpacing: '-0.05em',
              mb: 3,
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
              background: 'linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.7) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1
            }}
          >
            Refund & Replacement Policy
          </Typography>
          
          {/* Delivery Highlight */}
          <Box sx={{ mb: 4 }}>
            <Chip
              icon={<LocalShippingIcon />}
              label="✨ 7 Days Fast Delivery"
              sx={{
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: 2,
                px: 1,
                height: 'auto',
                '& .MuiChip-icon': {
                  color: '#22c55e'
                }
              }}
            />
          </Box>
          
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.7)', 
              fontWeight: 400,
              fontSize: { xs: '1rem', sm: '1.125rem' },
              maxWidth: '800px',
              mx: 'auto',
              lineHeight: 1.6,
              px: { xs: 2, sm: 0 }
            }}
          >
            At MaddyCustom, we strive to deliver high-quality products and a seamless customer experience.
            Your satisfaction is our priority.
          </Typography>
        </Box>

        {/* Fast Delivery Feature Card */}
        <Card 
          elevation={0}
          sx={{
            mb: { xs: 4, sm: 6 },
            p: { xs: 3, sm: 4 },
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '20px',
            textAlign: 'center'
          }}
        >
          <LocalShippingIcon sx={{ fontSize: 48, color: '#22c55e', mb: 2 }} />
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 800, 
              color: '#22c55e', 
              mb: 1,
              fontSize: { xs: '1.5rem', sm: '2rem' }
            }}
          >
            7 Days Fast Delivery
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: { xs: '1rem', sm: '1.125rem' },
              maxWidth: '600px',
              mx: 'auto',
              lineHeight: 1.6
            }}
          >
            Experience lightning-fast delivery with our commitment to get your custom products to you within 7 days. 
            Quality meets speed at MaddyCustom.
          </Typography>
        </Card>

        {/* Policy Sections */}
        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
          <Grid item xs={12} md={6}>
            <Section 
              title="Damaged Product Protection" 
              icon={<SecurityIcon />}
            >
              <Box>
                <NumberedItem 
                  number="1" 
                  text="If your order arrives damaged, we will replace it at no additional cost to you." 
                />
                <NumberedItem 
                  number="2" 
                  text="Please report the issue within 48 hours of delivery along with clear photos of the damaged product and packaging." 
                />
                <NumberedItem 
                  number="3" 
                  text="Once verified by our quality team, we will dispatch a replacement promptly within 2-3 business days." 
                />
              </Box>
            </Section>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Section 
              title="Size Mismatch Policy" 
              icon={<SwapHorizIcon />}
            >
              <Box>
                <NumberedItem 
                  number="1" 
                  text="In case you receive a product with an incorrect size, we offer a hassle-free replacement." 
                />
                <NumberedItem 
                  number="2" 
                  text={
                    <Box component="span">
                      A minimal reshipping charge of{' '}
                      <Typography 
                        component="span" 
                        sx={{ 
                          color: '#22c55e', 
                          fontWeight: 700, 
                          fontSize: { xs: '1rem', sm: '1.125rem' },
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          px: 1,
                          py: 0.25,
                          borderRadius: '4px'
                        }}
                      >
                        ₹100
                      </Typography>{' '}
                      will apply to cover logistics.
                    </Box>
                  } 
                />
                <NumberedItem 
                  number="3" 
                  text="Requests must be made within 3 days of delivery, and the original product must be returned in unused, pristine condition." 
                />
              </Box>
            </Section>
          </Grid>
        </Grid>
        
        {/* Contact Information */}
        <Card 
          elevation={0} 
          sx={{ 
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            p: { xs: 3, sm: 4 }, 
            mt: { xs: 4, sm: 6 },
            textAlign: 'center',
            borderRadius: '16px'
          }}
        >
          <Typography 
            variant="h6" 
            sx={{ 
              color: '#ffffff',
              fontSize: { xs: '1.125rem', sm: '1.25rem' },
              fontWeight: 600,
              mb: 1
            }}
          >
            Need Help?
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: { xs: '1rem', sm: '1.125rem' },
              lineHeight: 1.6
            }}
          >
            For any concerns or claims, contact us immediately. We&apos;re here to help make things right!
          </Typography>
        </Card>

        {/* Brand Tagline */}
        <Box sx={{ mt: { xs: 6, sm: 8 }, textAlign: 'center' }}>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 900, 
              fontStyle: 'italic',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.4) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
              lineHeight: 1.2
            }}
          >
            #OwnUniqueness
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default TermsAndConditionsPage;