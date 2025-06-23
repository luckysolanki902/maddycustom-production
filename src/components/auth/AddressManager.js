// @/components/auth/AddressManager.js
'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Radio,
  RadioGroup,
  FormControlLabel,
  styled,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const AddressContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  maxWidth: '580px',
  margin: '0 auto',
  padding: theme.spacing(2),
}));

const AddressCard = styled(Paper)(({ theme, selected }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  border: selected ? `2px solid ${theme.palette.primary.main}` : '1px solid #e0e0e0',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  backgroundColor: selected ? theme.palette.primary.lighter : theme.palette.background.paper,
  '&:hover': {
    boxShadow: theme.shadows[3],
  },
}));

const AddressList = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  maxHeight: '60vh',
  overflowY: 'auto',
  width: '100%',
  padding: theme.spacing(1),
}));

const AddButton = styled(Button)(({ theme }) => ({
  margin: theme.spacing(2, 0),
}));

const ActionsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: theme.spacing(1),
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(2),
  '& .MuiGrid-item': {
    marginBottom: theme.spacing(2),
  },
}));

const AddressManager = ({ 
  onSelectAddress, 
  onBack, 
  initialSelectedAddressId = null 
}) => {
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.auth);
  const user = authState.user;
  
  const [isLoading, setIsLoading] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(initialSelectedAddressId);
  
  // Address form dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAddress, setCurrentAddress] = useState(null);
  
  // Initial address form values
  const emptyAddressForm = {
    receiverName: '',
    receiverPhoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    isPrimary: false,
  };
  
  const [formValues, setFormValues] = useState(emptyAddressForm);
  const [formErrors, setFormErrors] = useState({});
  
  // Load addresses on component mount
  useEffect(() => {
    if (user?.id) {
      loadAddresses();
    }
  }, [user]);
  
  // Fetch user's addresses
  const loadAddresses = async () => {
    try {
      setIsLoading(true);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }
      
      const response = await axios.get('/api/user/addresses', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setAddresses(response.data.addresses || []);
      
      // If no address is selected yet, select primary or first available address
      if (!selectedAddressId && response.data.addresses?.length > 0) {
        const primaryAddress = response.data.addresses.find(addr => addr.isPrimary);
        setSelectedAddressId(primaryAddress?._id || response.data.addresses[0]._id);
      }
      
    } catch (error) {
      console.error('Failed to load addresses:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle address selection
  const handleSelectAddress = (addressId) => {
    setSelectedAddressId(addressId);
  };
  
  // Handle confirm address selection
  const handleConfirmAddress = () => {
    const selectedAddress = addresses.find(addr => addr._id === selectedAddressId);
    if (selectedAddress && onSelectAddress) {
      onSelectAddress(selectedAddress);
    }
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  // Toggle primary address
  const handlePrimaryToggle = (e) => {
    setFormValues(prev => ({
      ...prev,
      isPrimary: e.target.checked
    }));
  };
  
  // Open dialog to add new address
  const handleAddNewAddress = () => {
    setCurrentAddress(null);
    setFormValues(emptyAddressForm);
    setFormErrors({});
    setOpenDialog(true);
  };
  
  // Open dialog to edit address
  const handleEditAddress = (address) => {
    setCurrentAddress(address);
    setFormValues({
      receiverName: address.receiverName,
      receiverPhoneNumber: address.receiverPhoneNumber,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country || 'India',
      isPrimary: address.isPrimary || false
    });
    setFormErrors({});
    setOpenDialog(true);
  };
  
  // Handle delete address
  const handleDeleteAddress = async (addressId) => {
    try {
      setIsLoading(true);
      
      const token = localStorage.getItem('authToken');
      await axios.delete(`/api/user/addresses/${addressId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Refresh addresses
      await loadAddresses();
      
      // If deleted address was selected, reset selection
      if (addressId === selectedAddressId) {
        setSelectedAddressId(null);
      }
      
    } catch (error) {
      console.error('Failed to delete address:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formValues.receiverName) errors.receiverName = 'Name is required';
    if (!formValues.receiverPhoneNumber) {
      errors.receiverPhoneNumber = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formValues.receiverPhoneNumber)) {
      errors.receiverPhoneNumber = 'Enter a valid 10-digit phone number';
    }
    
    if (!formValues.addressLine1) errors.addressLine1 = 'Address line 1 is required';
    if (!formValues.city) errors.city = 'City is required';
    if (!formValues.state) errors.state = 'State is required';
    if (!formValues.pincode) {
      errors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(formValues.pincode)) {
      errors.pincode = 'Enter a valid 6-digit pincode';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle form submission
  const handleSubmitAddress = async () => {
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      
      const token = localStorage.getItem('authToken');
      const payload = { ...formValues };
      
      if (currentAddress) {
        // Update existing address
        await axios.put(`/api/user/addresses/${currentAddress._id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      } else {
        // Add new address
        await axios.post('/api/user/addresses', payload, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
      
      // Refresh addresses
      await loadAddresses();
      setOpenDialog(false);
      
    } catch (error) {
      console.error('Failed to save address:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <AddressContainer>
      {/* Back button and header */}
      <Box display="flex" alignItems="center" width="100%" mb={2}>
        <IconButton onClick={onBack}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" ml={1}>
          {addresses.length > 0 ? 'Select Delivery Address' : 'Add Delivery Address'}
        </Typography>
      </Box>
      
      {isLoading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Address list */}
          {addresses.length > 0 && (
            <AddressList>
              <AnimatePresence>
                {addresses.map((address) => (
                  <motion.div 
                    key={address._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AddressCard 
                      selected={address._id === selectedAddressId}
                      onClick={() => handleSelectAddress(address._id)}
                      elevation={address._id === selectedAddressId ? 3 : 1}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box display="flex" alignItems="center">
                          <Radio
                            checked={address._id === selectedAddressId}
                            onChange={() => handleSelectAddress(address._id)}
                            color="primary"
                          />
                          <Box ml={1}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {address.receiverName}
                              {address.isPrimary && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="primary"
                                  sx={{ ml: 1, fontWeight: 600, bgcolor: 'primary.lighter', px: 1, py: 0.5, borderRadius: 1 }}
                                >
                                  PRIMARY
                                </Typography>
                              )}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {address.receiverPhoneNumber}
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Box>
                          <IconButton size="small" onClick={(e) => {
                            e.stopPropagation();
                            handleEditAddress(address);
                          }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAddress(address._id);
                          }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                      
                      <Box pl={7}>
                        <Typography variant="body2">
                          {address.addressLine1}
                          {address.addressLine2 && `, ${address.addressLine2}`}
                        </Typography>
                        <Typography variant="body2">
                          {address.city}, {address.state}, {address.pincode}
                        </Typography>
                      </Box>
                    </AddressCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </AddressList>
          )}
          
          {/* Add new address button */}
          <AddButton 
            variant="outlined" 
            startIcon={<AddIcon />}
            onClick={handleAddNewAddress}
            fullWidth
          >
            Add New Address
          </AddButton>
          
          {/* Actions */}
          {addresses.length > 0 && (
            <Button
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              disabled={!selectedAddressId}
              onClick={handleConfirmAddress}
            >
              Deliver to this Address
            </Button>
          )}
        </>
      )}
      
      {/* Address form dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => !isSubmitting && setOpenDialog(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {currentAddress ? 'Edit Address' : 'Add New Address'}
        </DialogTitle>
        
        <Divider />
        
        <StyledDialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Full Name"
                name="receiverName"
                value={formValues.receiverName}
                onChange={handleInputChange}
                error={!!formErrors.receiverName}
                helperText={formErrors.receiverName || ''}
                disabled={isSubmitting}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                name="receiverPhoneNumber"
                value={formValues.receiverPhoneNumber}
                onChange={handleInputChange}
                error={!!formErrors.receiverPhoneNumber}
                helperText={formErrors.receiverPhoneNumber || ''}
                disabled={isSubmitting}
                inputProps={{
                  maxLength: 10,
                  inputMode: 'numeric'
                }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address Line 1"
                name="addressLine1"
                value={formValues.addressLine1}
                onChange={handleInputChange}
                error={!!formErrors.addressLine1}
                helperText={formErrors.addressLine1 || ''}
                disabled={isSubmitting}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address Line 2 (Optional)"
                name="addressLine2"
                value={formValues.addressLine2}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="City"
                name="city"
                value={formValues.city}
                onChange={handleInputChange}
                error={!!formErrors.city}
                helperText={formErrors.city || ''}
                disabled={isSubmitting}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="State"
                name="state"
                value={formValues.state}
                onChange={handleInputChange}
                error={!!formErrors.state}
                helperText={formErrors.state || ''}
                disabled={isSubmitting}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Pincode"
                name="pincode"
                value={formValues.pincode}
                onChange={handleInputChange}
                error={!!formErrors.pincode}
                helperText={formErrors.pincode || ''}
                disabled={isSubmitting}
                inputProps={{
                  maxLength: 6,
                  inputMode: 'numeric'
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Country"
                name="country"
                value={formValues.country}
                onChange={handleInputChange}
                disabled={true}
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Radio
                    checked={formValues.isPrimary}
                    onChange={handlePrimaryToggle}
                    disabled={isSubmitting}
                  />
                }
                label="Set as primary address"
              />
            </Grid>
          </Grid>
        </StyledDialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setOpenDialog(false)} 
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitAddress}
            variant="contained" 
            color="primary"
            disabled={isSubmitting}
            startIcon={isSubmitting && <CircularProgress size={20} color="inherit" />}
          >
            {isSubmitting ? 'Saving...' : 'Save Address'}
          </Button>
        </DialogActions>
      </Dialog>
    </AddressContainer>
  );
};

export default AddressManager;
