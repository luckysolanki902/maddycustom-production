'use client';

/**
 * LetterMappingPopup (Reusable)
 * Frontend-only popup for choosing letter-mapping groups to build a variant code.
 * Props:
 *  - open
 *  - onClose
 *  - groups: [{ groupName, mappings: [{ letterCode, name, thumbnail? }], thumbnailRequired? }]
 *  - baseCode: prefix for variant code (e.g. 'F')
 *  - onSubmit({ finalCode, selections })
 *  - loading
 *  - title
 *  - submitLabel
 */
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, Box, Checkbox, FormControlLabel, Button, IconButton, Chip, Typography, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Image from 'next/image';

const DEFAULT_GROUPS = [
  {
    groupName: 'Finish',
    thumbnailRequired: false,
    mappings: [
      { letterCode: 'R', name: 'Regular' },
      { letterCode: 'C', name: 'Carbon' },
    ]
  }
];

export default function LetterMappingPopup({
  open,
  onClose,
  groups = DEFAULT_GROUPS,
  baseCode = 'F',
  onSubmit,
  loading = false,
  title = 'Choose Options',
  submitLabel = 'Submit'
}) {
  const [selections, setSelections] = useState({});
  const [finalized, setFinalized] = useState(false);
  const [finalProductCode, setFinalProductCode] = useState(null);

  useEffect(() => {
    if (!open) {
      setSelections({});
      setFinalized(false);
      setFinalProductCode(null);
    }
  }, [open]);

  const handleSelect = (groupName, letterCode) => {
    setSelections(prev => ({ ...prev, [groupName]: letterCode }));
  };

  const allChosen = groups.every(g => selections[g.groupName]);

  const buildCode = () => {
    let code = baseCode;
    for (const g of groups) code += selections[g.groupName] || '';
    return code;
  };

  const handleSubmit = () => {
    if (!allChosen) return;
    const finalCode = buildCode();
    setFinalProductCode(finalCode);
    setFinalized(true);
    onSubmit && onSubmit({ finalCode, selections });
  };

  const renderSelectedChips = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      <IconButton size="small" onClick={() => setFinalized(false)} aria-label="Back to selection">
        <ArrowBackIcon />
      </IconButton>
      {groups.map(group => {
        const letter = selections[group.groupName];
        if (!letter) return null;
        const option = group.mappings.find(o => o.letterCode === letter);
        const label = option ? `${group.groupName}: ${option.name}` : `${group.groupName}: ${letter}`;
        return <Chip key={group.groupName} label={label} />;
      })}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ fontFamily: 'Jost,sans-serif', fontSize: '1.75rem', fontWeight: 500, textAlign: 'center', pt: 3, pb: 1 }}>
          {title}
        </Box>
        {!finalized && (
          <Box sx={{ px: 2, pb: 2 }}>
            {groups.map(group => (
              <Box key={group.groupName} sx={{ mb: 3 }}>
                <div style={{ fontWeight: 600, textAlign: 'center', marginBottom: '.5rem' }}>{group.groupName}</div>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '.75rem' }}>
                  {group.mappings.map(option => {
                    const selected = selections[group.groupName] === option.letterCode;
                    const thumb = option.thumbnail;
                    return (
                      <Box key={option.letterCode} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: '.75rem', borderRadius: '1rem', cursor: 'pointer', border: selected ? '2px solid #111' : '1px solid #e5e5e5', background: selected ? '#fafafa' : '#fff', transition: 'all .25s', position: 'relative', boxShadow: selected ? '0 2px 6px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.03)' }} onClick={() => handleSelect(group.groupName, option.letterCode)}>
                        {thumb && (
                          <Image src={thumb.startsWith('http') ? thumb : (thumb.startsWith('/') ? process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL+thumb : '/' + process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL+thumb)} alt={option.name} width={160} height={160} style={{ objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} quality={90} />
                        )}
                        <FormControlLabel control={<Checkbox checked={selected} onChange={() => handleSelect(group.groupName, option.letterCode)} />} label={option.name} sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '.8rem', textAlign: 'center', fontWeight: 500 } }} />
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 2 }}>
              <Button disabled={!allChosen || loading} variant="contained" onClick={handleSubmit} sx={{ background: '#000', borderRadius: '0.9rem', px: 4 }}>
                {submitLabel}
                {loading && <CircularProgress size={18} sx={{ ml: 1, color: '#fff' }} />}
              </Button>
            </Box>
          </Box>
        )}
        {finalized && (
          <Box sx={{ px: 2, pb: 2 }}>
            {renderSelectedChips()}
            <Typography variant="body2" sx={{ mb: 1 }}>
              Mapping submitted. You can now browse the updated add‑ons.
            </Typography>
            <Button onClick={onClose} variant="outlined" size="small" sx={{ textTransform: 'none' }}>Close</Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
