"use client";
import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, Button, Slide, Typography, Box, Divider, Chip } from '@mui/material';
import { setField, setDialogOpen, resetForm } from '@/store/slices/b2bFormSlice';
import { clearB2BSelection } from '@/store/slices/b2bSelectionSlice';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function B2BOrderDialog(){
  const dispatch = useDispatch();
  const form = useSelector(s=>s.b2bForm);
  const items = useSelector(s=>s.b2bSelection.items);
  const open = form.dialogOpen;
  const totalQty = items.reduce((a,i)=>a+(i.quantity||0),0);
  const [submitting,setSubmitting] = useState(false);
  const set = useCallback((field,value)=>dispatch(setField({field,value})),[dispatch]);
  const close = ()=> dispatch(setDialogOpen(false));
  const canSubmit = items.length>0 && form.businessName && form.contactName && form.contactEmail && form.contactPhone;
  const submit = async()=>{
    if(!canSubmit||submitting) return; setSubmitting(true);
    try{
      const res = await fetch('/api/b2b/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        businessName: form.businessName, contactName: form.contactName, contactEmail: form.contactEmail, contactPhone: form.contactPhone, role: form.role, notes: form.notes,
        address:{ line1:form.line1, line2:form.line2, city:form.city, state:form.state, pincode:form.pincode, country:form.country }, items })});
      const data = await res.json(); if(res.ok){
        // Clear selection & form now (confirmation page pulls from DB, not client state)
        dispatch(clearB2BSelection());
        dispatch(resetForm());
        dispatch(setDialogOpen(false));
        window.location.href=`/b2b/confirmation/${data.orderId}`; // hard redirect ensures fresh server fetch
      } else { setSubmitting(false); alert(data.error||'Failed'); }
    }catch(e){ console.error(e); alert('Error'); setSubmitting(false);} };
  const requiredProps = (label,field,type='text',extra={}) => <TextField label={label} value={form[field]} onChange={e=>set(field,e.target.value)} size="small" fullWidth type={type} variant="outlined" sx={textFieldSx} {...extra}/>;
  const grouped = useMemo(()=>{ const out={}; items.forEach(i=>{ const cat=i.category||'Other'; const sub=i.subCategory||'General'; if(!out[cat]) out[cat]={total:0,subs:{}}; if(!out[cat].subs[sub]) out[cat].subs[sub]=0; out[cat].total += (i.quantity||0); out[cat].subs[sub]+=(i.quantity||0); }); return out; },[items]);
  const summaryChips = Object.entries(grouped).map(([cat,val])=> <Chip key={cat} label={`${cat}: ${val.total}`} size="small" sx={{bgcolor:'#111',color:'#fff',fontWeight:600}}/>);
  return (
    <Dialog open={open} onClose={submitting?undefined:close} TransitionComponent={Transition} maxWidth="lg" fullWidth PaperProps={{sx:{borderRadius:{xs:0,sm:16}, background:'linear-gradient(145deg,#ffffff,#f5f7fa,#eef1f4)', border:'1px solid #e3e7ec', boxShadow:'0 40px 90px -28px rgba(0,0,0,0.5)', position:'relative'}}}>
      <AnimatePresence>
        {submitting && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:'absolute', inset:0, background:'rgba(255,255,255,0.65)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10}}>
            <motion.div initial={{scale:.9,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:260,damping:20}} style={{background:'#2d2d2d',color:'#fff',padding:'14px 22px',borderRadius:12,fontSize:14,fontWeight:600,letterSpacing:'.5px'}}>Submitting…</motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <DialogTitle sx={{fontWeight:800,pb:0,fontSize:{xs:18,sm:22},display:'flex',alignItems:'center',gap:1,background:'linear-gradient(120deg,#101010,#1f1f1f)',color:'#fff',px:{xs:2,sm:4},py:{xs:2,sm:2.5}}}>
        <span style={{background:'#fff',color:'#111',padding:'6px 14px',borderRadius:32,fontSize:12,letterSpacing:'.6px',fontWeight:700}}>B2B</span>
        <span style={{background:'linear-gradient(90deg,#fff,#d0d4d9)',WebkitBackgroundClip:'text',color:'transparent'}}>Bulk Request Details</span>
      </DialogTitle>
      <DialogContent sx={{pt:{xs:3,sm:4},px:{xs:2.5,sm:4},pb:{xs:2.5,sm:3}}}>
        <Typography variant="body2" sx={{mb:3,mt:3, color:'#353b44',fontSize:{xs:12.8,sm:13.6},lineHeight:1.5}}>Provide your business & contact details. Detailed SKU list appears after you submit.</Typography>
        <Grid container spacing={{xs:2,sm:2.5}}>
          <Grid item xs={12} sm={6}>{requiredProps('Business / Organization Name','businessName')}</Grid>
          <Grid item xs={12} sm={6}>{requiredProps('Your Name','contactName')}</Grid>
          <Grid item xs={12} sm={6}>{requiredProps('Email','contactEmail','email')}</Grid>
          <Grid item xs={12} sm={6}>{requiredProps('Phone / WhatsApp','contactPhone','tel')}</Grid>
          <Grid item xs={12} sm={6}>{requiredProps('Your Role / Title (optional)','role')}</Grid>
          <Grid item xs={12} sm={6}>{requiredProps('Country','country')}</Grid>
          <Grid item xs={12} sm={8}>{requiredProps('Address Line 1','line1')}</Grid>
          <Grid item xs={12} sm={4}>{requiredProps('Address Line 2','line2')}</Grid>
          <Grid item xs={12} sm={4}>{requiredProps('City','city')}</Grid>
          <Grid item xs={6} sm={4}>{requiredProps('State / Province','state')}</Grid>
          <Grid item xs={3} sm={2}>{requiredProps('Postal Code','pincode')}</Grid>
          <Grid item xs={12}><TextField label="Notes / Requirements" value={form.notes} onChange={e=>set('notes',e.target.value)} fullWidth multiline minRows={3} size="small" placeholder="Eg. Need matte finish, mixed colors, custom branding..." sx={textFieldSx}/></Grid>
        </Grid>
        <Divider sx={{my:3}}/>
        <Box sx={{display:'flex',flexDirection:'column',gap:1}}>
          <Typography variant="subtitle2" sx={{fontWeight:700,color:'#111'}}>Selection Summary</Typography>
            <Box sx={{display:'flex',flexWrap:'wrap',gap:1}}>
              {summaryChips.length? summaryChips : <Typography variant="caption" color="text.secondary">No items selected yet.</Typography>}
            </Box>
          <Typography variant="caption" sx={{color:'#555'}}>Distinct Products: {items.length} • Total Units: {totalQty}</Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{px:{xs:2.5,sm:4},py:{xs:2,sm:2.5},background:'linear-gradient(to top,#f1f3f5,#ffffff00)',gap:1.5}}>
        <Button onClick={close} color="inherit" sx={{textTransform:'none',fontWeight:500,borderRadius:2}}>Cancel</Button>
        <Button disabled={!canSubmit||submitting} onClick={submit} variant="contained" sx={{textTransform:'none',fontWeight:700,px:{xs:2.5,sm:4},py:1.1,fontSize:{xs:13.5,sm:14.5},borderRadius:3,bgcolor:canSubmit?'#111':'#555',':hover':{bgcolor:canSubmit?'#1c1c1c':'#555'}}}>Send Request</Button>
      </DialogActions>
    </Dialog>
  );
}

// Shared TextField styling accenting #2d2d2d
const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius:3,
    background:'#fff',
    '& fieldset': { borderColor:'#d4d8dd' },
    '&:hover fieldset': { borderColor:'#111' },
    '&.Mui-focused fieldset': { borderColor:'#111', borderWidth:1.6 },
    '& input, & textarea': { padding:'10px 13px', fontSize:14.5, fontWeight:500 }
  },
  '& .MuiInputLabel-root': { fontSize:13.2, fontWeight:500, letterSpacing:'.3px' },
  '& .MuiInputLabel-root.Mui-focused': { color:'#111' }
};