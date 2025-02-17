'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, Divider, Box, Button, Checkbox, FormControlLabel } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './styles/changevariantbutton.module.css';
import { useMediaQuery } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import {
  setHasSeenVariantPopup,
  setPageSlug,
} from '@/store/slices/variantPreferenceSlice';

export default function ChangeVariantButton({ category }) {
  const [showPopup, setShowPopup] = useState(false);
  const [variants, setVariants] = useState([]);
  const [useMapping, setUseMapping] = useState(false);
  const [letterMappingGroups, setLetterMappingGroups] = useState([]);
  const [mappingSelections, setMappingSelections] = useState({});

  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const router = useRouter();
  const dispatch = useDispatch();

  const categoryPreferences = useSelector(
    (state) => state.variantPreference[category._id]
  );
  const hasSeenVariantPopup = categoryPreferences?.hasSeenVariantPopup || false;

  useEffect(() => {
    if (category.useLetterMapping) {
      setUseMapping(true);
      setLetterMappingGroups(category.letterMappingGroups || []);
    }
    const fetchVariants = async () => {
      try {
        const response = await fetch(
          `/api/features/get-variants?categoryId=${category._id}`
        );
        const data = await response.json();
        setVariants(data.variants?.reverse());
      } catch (error) {
        console.error('Error fetching variants:', error);
      }
    };
    fetchVariants();
  }, [category]);

  useEffect(() => {
    if (!useMapping && variants.length > 2 && !hasSeenVariantPopup) {
      const timer = setTimeout(() => {
        setShowPopup(true);
        dispatch(
          setHasSeenVariantPopup({ categoryId: category._id, hasSeen: true })
        );
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [variants, hasSeenVariantPopup, dispatch, category._id, useMapping]);

  if (!useMapping && variants.length < 2) return null;

  const handleVariantClick = (slug) => {
    dispatch(setPageSlug({ categoryId: category._id, pageSlug: slug }));
    router.push(`/shop${slug}`);
    setShowPopup(false);
  };

  const handleMappingChange = (groupName, letterCode) => {
    setMappingSelections((prev) => ({
      ...prev,
      [groupName]: letterCode,
    }));
  };

  const handleMappingSubmit = () => {
    let finalCode = category.specificCategoryCode;
    for (const group of letterMappingGroups) {
      const chosenLetter = mappingSelections[group.groupName];
      if (!chosenLetter) {
        alert(`Please choose an option for ${group.groupName}`);
        return;
      }
      finalCode += chosenLetter;
    }

    const finalSlug = `/shop/${finalCode}`; // Construct the slug
    dispatch(setPageSlug({ categoryId: category._id, pageSlug: finalSlug }));
    router.push(finalSlug);
    setShowPopup(false);
  };

  return (
    <>
      <div
        className={styles.bikeStyle}
        onClick={() => setShowPopup(true)}
      >
        {useMapping
          ? 'Customize Variant' 
          : category.name === "Tank Wraps"
            ? "Change Tank Size"
            : "Change Variant"
        }
      </div>

      {!useMapping && (
        <Dialog
          open={showPopup}
          fullWidth
          onClose={() => setShowPopup(false)}
          PaperProps={{
            style: {
              borderRadius: '20px',
              padding: '1rem',
              maxWidth: '600px',
              backgroundColor: '#e2e2e2',
            },
          }}
        >
          <DialogContent className={styles.dialogContent}>
            <div className={`${styles.jostFam} ${styles.maindialogHeading}`}>
              CHOOSE
            </div>
            <div className={styles.categoryName}>
              {category.name === "Tank Wraps" ? "Tank Size" : category.name}
            </div>
            <Box display="flex" flexDirection="column" gap="1rem">
              {variants.map((variant, index) => (
                <Box key={variant.id}>
                  <Box
                    onClick={() => handleVariantClick(variant.pageSlug)}
                    className={styles.variantBox}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: '0.5rem',
                      padding: '1rem 1rem',
                    }}
                  >
                    {variant.image && (
                      <Image
                        src={`${baseImageUrl}${variant.image.startsWith('/') ? variant.image : '/' + variant.image}`}
                        className={styles.customImg}
                        alt={variant.name}
                        width={360 * 1.5}
                        height={150 * 1.5}
                      />
                    )}
                    <Box className={styles.variantInfoParentBox}>
                      <div className={styles.buttongroup}>
                        <button className={styles.variantButton}>
                          {variant?.name?.toLowerCase().includes('tank')
                            ? variant.name.split(' ')[0]
                            : variant.name}
                        </button>
                      </div>
                      <div className={styles.variantDescription}>
                        {variant.variantInfo.split(':')[0]}:
                        <strong
                          style={{ fontWeight: 'bold', marginLeft: '0.3rem' }}
                        >
                          {variant.variantInfo.split(':')[1]}
                        </strong>
                      </div>
                    </Box>
                  </Box>
                  {index !== variants.length - 1 && (
                    <Divider
                      key={index}
                      style={{ marginTop: '20px', borderColor: 'black' }}
                    />
                  )}
                </Box>
              ))}
            </Box>
          </DialogContent>
        </Dialog>
      )}

      {useMapping && (
        <Dialog
          open={showPopup}
          fullWidth
          onClose={() => setShowPopup(false)}
          PaperProps={{
            sx: {
              borderRadius: '20px',
              padding: '1rem',
              maxWidth: '400px',
              backgroundColor: '#ffffff',
              width:'100%',
              overflow:'hidden'
            },
          }}
        >
          <DialogContent>
            <div
              sx={{
                fontSize: '1.5rem',
                textAlign: 'center',
                fontWeight: 'bold',
                marginBottom: '1rem',
                width: '100%',
                overflow:'hidden',
              }}
            >
              CHOOSE
            </div>

            {letterMappingGroups.map((group) => (
                
              <Box key={group.groupName} sx={{ marginBottom: '1rem',  }}>
                <div style={{ fontWeight: 'bold' }}>{group.groupName}</div>
                {group.question && (
                  <div style={{ marginBottom: '0.5rem' }}>{group.question}</div>
                )}
                <Box sx={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {group.mappings.map((option) => (
                    <Box
                      key={option.letterCode}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleMappingChange(group.groupName, option.letterCode)}
                    >
                      {option.thumbnailRequired && option.thumbnail && (
                        <Image
                          src={option.thumbnail.startsWith('/')
                            ? option.thumbnail
                            : `/${option.thumbnail}`
                          }
                          alt={option.name}
                          width={80}
                          height={80}
                          style={{ border: '1px solid #999', borderRadius: '4px' }}
                        />
                      )}
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={
                              mappingSelections[group.groupName] ===
                              option.letterCode
                            }
                          />
                        }
                        label={option.name}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}

            <Button
              variant="contained"
              onClick={handleMappingSubmit}
              style={{ marginTop: '1rem' }}
            >
              Submit
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
