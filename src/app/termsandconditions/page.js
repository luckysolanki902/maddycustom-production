import React from 'react';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { Container, Typography, Paper, Box, Divider, Grid } from '@mui/material';

export async function generateMetadata() {
    return createMetadata({
        title: 'Refund & Replacement Policy - Maddy Custom',
        canonical: 'https://www.maddycustom.com/termsandconditions',
    });
}

const Section = ({ title, children }) => {
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        my: { xs: 3, md: 4 }, 
        p: { xs: 2, sm: 3 }, 
        backgroundColor: '#333333',
        borderLeft: '4px solid #4a4a4a',
        borderRadius: '2px',
        transition: 'transform 0.2s ease-in-out',
        '&:hover': {
          transform: { xs: 'none', md: 'translateX(5px)' }
        }
      }}
    >
      <Typography 
        variant="h5" 
        component="h2" 
        sx={{ 
          mb: 2, 
          fontWeight: 600, 
          color: '#f5f5f5',
          borderBottom: '1px solid #4a4a4a',
          pb: 1,
          display: 'inline-block',
          fontSize: { xs: '1.25rem', sm: '1.5rem' }
        }}
      >
        {title}
      </Typography>
      {children}
    </Paper>
  );
};

const NumberedItem = ({ number, text }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1 }}>
      <Typography 
        variant="h6" 
        component="span" 
        sx={{ 
          color: '#a0a0a0', 
          fontWeight: 700, 
          mr: { xs: 1, sm: 2 },
          fontSize: { xs: '1rem', sm: '1.1rem' }
        }}
      >
        {number}
      </Typography>
      <Typography 
        variant="body1" 
        sx={{ 
          color: '#e0e0e0',
          fontSize: { xs: '0.9rem', sm: '1rem' },
          fontWeight: 400
        }}
      >
        {text}
      </Typography>
    </Box>
  );
};

const TermsAndConditionsPage = () => {
  return (
    <Box sx={{ backgroundColor: '#2d2d2d', minHeight: '100vh', py: { xs: 4, sm: 6 } }}>
      <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
        {/* Header */}
        <Box sx={{ mb: { xs: 4, sm: 6 }, textAlign: 'center' }}>
          <Typography 
            variant="h2" 
            component="h1" 
            sx={{ 
              fontWeight: 800, 
              color: '#ffffff',
              letterSpacing: '0.5px',
              mb: 2,
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' }
            }}
          >
            Refund & Replacement Policy
          </Typography>
          <Divider sx={{ backgroundColor: '#4a4a4a', height: '2px', width: '80px', mx: 'auto', mb: { xs: 3, sm: 4 } }} />
          <Typography 
            variant="subtitle1" 
            sx={{ 
              color: '#b0b0b0', 
              fontWeight: 400,
              fontSize: { xs: '0.95rem', sm: '1.1rem' },
              maxWidth: '700px',
              mx: 'auto',
              lineHeight: 1.6,
              px: { xs: 1, sm: 0 }
            }}
          >
            At MaddyCustom, we strive to deliver high-quality products and a seamless customer experience. 
            {/* While we do not offer refunds, we are happy to assist you with replacements under the following conditions: */}
          </Typography>
        </Box>

        {/* Policy Sections */}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Section title="Damaged Product">
              <Box sx={{ pl: { xs: 0.5, sm: 1 } }}>
                <NumberedItem 
                  number="01." 
                  text="If your order arrives damaged, we will replace it at no additional cost." 
                />
                <NumberedItem 
                  number="02." 
                  text="Please report the issue within 48 hours of delivery along with clear photos of the damaged product and packaging." 
                />
                <NumberedItem 
                  number="03." 
                  text="Once verified, we will dispatch a replacement promptly." 
                />
              </Box>
            </Section>
          </Grid>
          
          <Grid item xs={12}>
            <Section title="Size Mismatch">
              <Box sx={{ pl: { xs: 0.5, sm: 1 } }}>
                <NumberedItem 
                  number="01." 
                  text="In case you receive a product with an incorrect size, we offer a replacement." 
                />
                <NumberedItem 
                  number="02." 
                  text={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      A reshipping charge of 
                      <Typography 
                        component="span" 
                        sx={{ 
                          px: 1, 
                          color: '#ffffff', 
                          fontWeight: 700, 
                          fontSize: { xs: '0.95rem', sm: '1.05rem' }
                        }}
                      >
                        ₹100
                      </Typography> 
                      will apply.
                    </Box>
                  } 
                />
                <NumberedItem 
                  number="03." 
                  text="Requests must be made within 3 days of delivery, and the original product must be returned in unused condition." 
                />
              </Box>
            </Section>
          </Grid>
        </Grid>
        
        {/* Contact Information */}
        <Paper 
          elevation={0} 
          sx={{ 
            backgroundColor: '#3a3a3a',
            p: { xs: 2, sm: 3 }, 
            mt: 2,
            textAlign: 'center',
            borderRadius: '2px'
          }}
        >
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#d0d0d0',
              fontSize: { xs: '0.95rem', sm: '1.05rem' }
            }}
          >
            For any concerns or claims, contact us. We&apos;re here to help!
          </Typography>
        </Paper>

        {/* Brand Tagline */}
        <Box sx={{ mt: { xs: 4, sm: 6 }, textAlign: 'center' }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 800, 
              fontStyle: 'italic',
              color: '#a0a0a0',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
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