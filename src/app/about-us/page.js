

import React from 'react';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { Container, Typography, Paper, Box, Divider, Grid, Link, Button, IconButton } from '@mui/material';
import TopBoughtProducts from '@/components/showcase/products/TopBoughtProducts';
import InstagramIcon from '@mui/icons-material/Instagram';

export async function generateMetadata() {
    return createMetadata({
      title: 'About Us | Maddy Custom',
      canonical: 'https://www.maddycustom.com/about',
    });
}

const Section = ({ title, content }) => {
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        my: { xs: 2, md: 3 }, 
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
      <Typography 
        variant="body1" 
        sx={{ 
          color: '#e0e0e0',
          fontSize: { xs: '0.9rem', sm: '1rem' },
          fontWeight: 400,
          lineHeight: 1.7
        }}
      >
        {content}
      </Typography>
    </Paper>
  );
};

const AboutPage = () => {
  return (
    <Box sx={{ backgroundColor: '#2d2d2d', minHeight: '100vh', py: { xs: 4, sm: 6 } }}>
      <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
        {/* Header */}        <Box sx={{ mb: { xs: 4, sm: 6 }, textAlign: 'center' }}>
          <Typography 
            variant="h2" 
            component="h1" 
            sx={{ 
              fontWeight: 800, 
              color: '#ffffff',
              letterSpacing: '0.5px',
              mb: 2,
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            About Us
          </Typography>
          <Divider sx={{ backgroundColor: '#4a4a4a', height: '2px', width: '80px', mx: 'auto', mb: { xs: 3, sm: 4 } }} /><Typography 
            variant="subtitle1" 
            sx={{ 
              color: '#b0b0b0', 
              fontWeight: 400,
              fontSize: { xs: '0.95rem', sm: '1.1rem' },
              maxWidth: '700px',
              mx: 'auto',
              lineHeight: 1.6,
              px: { xs: 1, sm: 0 },
              mb: 3
            }}
          >
            Welcome to Maddycustom, where we transform ordinary vehicles into personalized masterpieces through premium wraps and accessories that reflect your unique style and personality.
          </Typography>
        </Box>

        {/* About Sections */}
        <Grid container spacing={2}>          <Grid item xs={12} md={6}>
            <Section 
              title="Our Journey" 
              content="At Maddycustom, we started with a passion for automotive aesthetics and personalization. Our journey began with the vision to make premium vehicle customization accessible to every enthusiast, allowing you to express your unique style through your ride." 
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Section 
              title="What Sets Us Apart" 
              content="Our extensive range of premium products—from car window pillar wraps to bike tank wraps, custom keychains to designer air fresheners—are crafted with precision. We combine cutting-edge materials with artistic designs to deliver personalization that truly stands out." 
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Section 
              title="Our Products" 
              content="We specialize in car window pillar wraps, bonnet wraps, fuel cap wraps, bike tank wraps, custom keychains, designer air fresheners, and are expanding into mats, seat covers, and graphic personalization solutions. Each product is designed to transform your vehicle into a statement of your personality." 
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Section 
              title="Our Commitment" 
              content="Quality is our signature. Each wrap and accessory undergoes rigorous quality checks to ensure durability, perfect fit, and stunning aesthetics. We use premium materials that withstand the elements while maintaining their vibrant appearance for years to come." 
            />
          </Grid>
          
          <Grid item xs={12}>            <Paper 
              elevation={0} 
              sx={{ 
                backgroundColor: '#3a3a3a',
                p: { xs: 3, sm: 4 }, 
                mt: 2,
                textAlign: 'center',
                borderRadius: '2px',
                borderLeft: '4px solid #5a5a5a',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease',
                '&:hover': {
                  transform: { xs: 'none', md: 'translateY(-3px)' },
                  boxShadow: '0 6px 12px rgba(0,0,0,0.15)'
                }
              }}
            >              <Typography 
                variant="h6" 
                sx={{ 
                  color: '#f0f0f0',
                  fontWeight: 600,
                  mb: 2,
                  fontSize: { xs: '1.1rem', sm: '1.25rem' }
                }}
              >
                Join the Maddycustom Revolution
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: '#d0d0d0',
                  fontSize: { xs: '0.95rem', sm: '1.05rem' },
                  lineHeight: 1.8
                }}
              >
                Browse our exclusive collection, discover the perfect personalization for your vehicle, and become part of the growing Maddycustom community. 
                From subtle elegance to bold statements, we help you transform your ride into a reflection of your unique identity. 
                Drive with distinction, express with passion – that&apos;s the Maddycustom way.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
          {/* Brand Tagline */}
        <Box sx={{ mt: { xs: 4, sm: 6 }, textAlign: 'center' }}>
          <Paper 
            elevation={0}
            sx={{
              backgroundColor: 'rgba(58, 58, 58, 0.6)',
              borderRadius: '30px',
              py: 2,
              px: 4,
              display: 'inline-block',
              transition: 'transform 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)'
              }
            }}
          >
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 800, 
                fontStyle: 'italic',
                color: '#d8d8d8',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' },
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              #OwnUniqueness
            </Typography>
          </Paper>        </Box>

        {/* Instagram Section */}
        <Box 
          sx={{ 
            mt: { xs: 5, sm: 6 },
            mb: { xs: 5, sm: 6 },
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Paper
            elevation={0}
            sx={{
              backgroundColor: '#333333',
              p: { xs: 3, sm: 4 },
              borderRadius: '6px',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #C13584 0%, #E1306C 25%, #FD1D1D 50%, #F56040 75%, #FCAF45 100%)'
              }
            }}
          >
            <Grid container alignItems="center" spacing={3}>
              <Grid item xs={12} md={4} 
                sx={{ 
                  display: 'flex', 
                  justifyContent: { xs: 'center', md: 'flex-start' },
                  alignItems: 'center'
                }}
              >
                <Box
                  sx={{
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '50%',
                    p: 2.5,
                    display: 'inline-flex',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: '-5px',
                      left: '-5px',
                      right: '-5px',
                      bottom: '-5px',
                      borderRadius: '50%',
                      background: 'linear-gradient(45deg, #C13584, #E1306C, #FD1D1D, #F56040, #FCAF45)',
                      zIndex: -1
                    }
                  }}
                >
                  <InstagramIcon sx={{ fontSize: { xs: 40, md: 50 }, color: '#ffffff' }} />
                </Box>
              </Grid>
              
              <Grid item xs={12} md={8} sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    color: '#ffffff', 
                    fontWeight: 600,
                    mb: 1.5,
                    fontSize: { xs: '1.25rem', sm: '1.4rem' }
                  }}
                >
                  Follow Our Journey on Instagram
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: '#d0d0d0', 
                    mb: 2.5,
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                    lineHeight: 1.6
                  }}
                >
                  Discover the latest trends in vehicle customization, exclusive behind-the-scenes content, and stunning customer transformations. Join our community of over 6,500 automotive enthusiasts!
                </Typography>
                <Button
                  variant="contained"
                  component={Link}
                  href="https://www.instagram.com/maddycustom/"
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<InstagramIcon />}
                  sx={{
                    background: 'linear-gradient(45deg, #C13584, #E1306C, #FD1D1D)',
                    color: '#ffffff',
                    px: 3,
                    py: 1,
                    borderRadius: '30px',
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '0.95rem',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #A12574, #D1205C, #ED0D0D)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 15px rgba(193, 53, 132, 0.4)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  @maddycustom
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Box>

        {/* Top Products Section */}
        <Box sx={{ mt: 6, mb: 3 }}>
          <Paper
            elevation={0}
            sx={{
              backgroundColor: '#333333',
              p: { xs: 3, sm: 4 },
              borderRadius: '4px',
              borderLeft: '4px solid #4a4a4a',
            }}
          >
            <Typography 
              variant="h4" 
              component="h2" 
              sx={{ 
                textAlign: 'center',
                fontWeight: 700,
                color: '#f0f0f0',
                mb: 3,
                fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2rem' }
              }}
            >
              Customer Favorites
            </Typography>
            
            <Typography
              variant="body1"
              sx={{
                color: '#d0d0d0',
                textAlign: 'center',
                fontSize: { xs: '0.95rem', sm: '1.05rem' },
                lineHeight: 1.8,
                mb: 4,
                maxWidth: '800px',
                mx: 'auto'
              }}
            >
              Ready to transform your ride? Explore our most popular designs that have captivated thousands of customers. Each product below represents the perfect blend of style, durability, and precision engineering. These bestsellers aren't just accessories—they're statements. Join the ranks of satisfied customers who've elevated their vehicles from ordinary to extraordinary with these signature Maddycustom pieces.
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <TopBoughtProducts hideHeading={true}/>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default AboutPage;
