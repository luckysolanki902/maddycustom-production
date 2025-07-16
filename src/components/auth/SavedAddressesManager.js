'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Radio,
  FormControlLabel,
  styled,
  Divider,
  Badge,
  Autocomplete,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { setAddressDetails, setPrefilledAddress } from '@/store/slices/orderFormSlice';
import indianStates from '@/lib/constants/indianStates';

// Helper function for color transparency
const alpha = (color, opacity) => {
  return color + parseInt(opacity * 255).toString(16).padStart(2, '0');
};

// Styled components
const AddressContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  maxWidth: '520px',
  margin: '0 auto',
  padding: theme.spacing(1),
}));

const AddressCard = styled(Paper)(({ theme, selected }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(1.5),
  border: selected ? `2px solid ${theme.palette.primary.main}` : '1px solid #e0e0e0',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  backgroundColor: selected ? alpha(theme.palette.primary.main, 0.05) : theme.palette.background.paper,
  '&:hover': {
    boxShadow: theme.shadows[2],
    borderColor: selected ? theme.palette.primary.main : theme.palette.grey[400],
  },
  position: 'relative',
  borderRadius: '8px',
}));

const AddressList = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
  maxHeight: '60vh',
  overflowY: 'auto',
  width: '100%',
  padding: theme.spacing(0.5),
  '&::-webkit-scrollbar': {
    width: '4px',
  },
  '&::-webkit-scrollbar-track': {
    background: '#f1f1f1',
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#888',
    borderRadius: '4px',
  },
}));

const AddButton = styled(Button)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  borderRadius: '8px',
  textTransform: 'none',
  fontWeight: 600,
}));

const PrimaryBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '8px',
  right: '8px',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
  padding: theme.spacing(0.5, 1),
  borderRadius: '4px',
  fontSize: '0.7rem',
  fontWeight: 600,
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(2),
  '& .MuiGrid-item': {
    marginBottom: theme.spacing(2),
  },
}));

const SavedAddressesManager = ({ 
  onSelectAddress, 
  onBack,
  initialSelectedAddressId = null,
  validatePincode,
}) => {
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.auth);
  const user = authState.user;
  
  const [isLoading, setIsLoading] = useState(false);
  const [addresses, setAddresses] = useState([]);  const [selectedAddressId, setSelectedAddressId] = useState(initialSelectedAddressId);
  const [hasMoreThanLimit, setHasMoreThanLimit] = useState(false);
  // Changed from 5 to 3 addresses maximum
  const ADDRESS_LIMIT = 3;
  // By default, we only show the most recent or primary address
  // User can click to see all (up to ADDRESS_LIMIT)
  const [showAllAddresses, setShowAllAddresses] = useState(false);
  
  // Address form dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAddress, setCurrentAddress] = useState(null);
  // Get address details from Redux
  const addressDetails = useSelector((state) => state.orderForm.addressDetails);
  
  // Initial address form values with useMemo to prevent re-creation on each render
  const emptyAddressForm = useMemo(() => ({
    receiverName: user?.name || '',
    receiverPhoneNumber: user?.phoneNumber || '',
    // Use Redux state for address details if available, otherwise empty string
    addressLine1: addressDetails?.addressLine1 || '',
    addressLine2: addressDetails?.addressLine2 || '',
    city: addressDetails?.city || '',
    state: addressDetails?.state || '',
    pincode: addressDetails?.pincode || '',
    country: 'India',
    isPrimary: addresses.length === 0, // Default first address to primary
  }), [user, addresses.length, addressDetails]);
  
  const [formValues, setFormValues] = useState(emptyAddressForm);
  const [formErrors, setFormErrors] = useState({});
    // Fetch user's addresses with useCallback
  const loadAddresses = useCallback(async () => {
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
      
      let addressList = response.data.addresses || [];
      
      // Always start by checking if there's a primary address
      const primaryAddress = addressList.find(addr => addr.isPrimary);
      
      // Sort the rest by recency (MongoDB ID contains timestamp)
      // Note: Using timestamps (newest first) for sorting to ensure we keep the most recent addresses
      const nonPrimaryAddresses = addressList.filter(addr => !addr.isPrimary)
        .sort((a, b) => b._id.localeCompare(a._id));
      
      // Check if we have more than the limit (lowered to 3 from 5)
      // ADDRESS_LIMIT is now set to 3
      const ADDRESS_LIMIT = 3;
      const exceedsLimit = addressList.length > ADDRESS_LIMIT;
      setHasMoreThanLimit(exceedsLimit);
      
      // Construct final address list: primary first (if exists), then most recent addresses
      let finalAddressList = [];
      if (primaryAddress) {
        finalAddressList.push(primaryAddress);
        // Add remaining addresses up to ADDRESS_LIMIT-1 (to account for primary)
        finalAddressList = [...finalAddressList, ...nonPrimaryAddresses.slice(0, ADDRESS_LIMIT - 1)];
      } else {
        // No primary address, take up to ADDRESS_LIMIT most recent addresses
        finalAddressList = nonPrimaryAddresses.slice(0, ADDRESS_LIMIT);
      }
      
      // If we have more than ADDRESS_LIMIT addresses, delete the extra addresses from the backend
      if (exceedsLimit) {
        // Get addresses to delete (all addresses not in finalAddressList)
        const addressesToDelete = addressList.filter(addr => 
          !finalAddressList.some(keepAddr => keepAddr._id === addr._id)
        );
        
        // Delete extra addresses in the background
        for (const addrToDelete of addressesToDelete) {
          try {
            await axios.delete(`/api/user/addresses/${addrToDelete._id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            console.log(`Deleted address ${addrToDelete._id} (cleanup)`);
          } catch (deleteError) {
            console.error('Error deleting extra address:', deleteError);
            // Continue with the next deletion even if one fails
          }
        }
      }
      
      setAddresses(finalAddressList);
      
      // If no address is selected yet or selected address doesn't exist in the filtered list,
      // select primary or first available address
      if ((!selectedAddressId || !finalAddressList.find(addr => addr._id === selectedAddressId)) && 
          finalAddressList.length > 0) {
        const primaryAddress = finalAddressList.find(addr => addr.isPrimary);
        const addressToSelect = primaryAddress?._id || finalAddressList[0]._id;
        setSelectedAddressId(addressToSelect);
        
        // Also prefill address in redux for the default selected address
        const selectedAddr = finalAddressList.find(addr => addr._id === addressToSelect);
        if (selectedAddr) {
          dispatch(setPrefilledAddress({
            addressLine1: selectedAddr.addressLine1,
            addressLine2: selectedAddr.addressLine2 || '',
            city: selectedAddr.city,
            state: selectedAddr.state,
            pincode: selectedAddr.pincode,
            country: selectedAddr.country || 'India',
          }));
          
          // Also set in immediate address details to ensure form is filled
          dispatch(setAddressDetails({
            addressLine1: selectedAddr.addressLine1,
            addressLine2: selectedAddr.addressLine2 || '',
            city: selectedAddr.city,
            state: selectedAddr.state,
            pincode: selectedAddr.pincode,
            country: selectedAddr.country || 'India',
          }));
        }
      }
      
    } catch (error) {
      console.error('Failed to load addresses:', error);
      // Show error notification
      if (error.response?.status === 401) {
        // Authentication error
        alert('Your session has expired. Please log in again.');
      } else {
        // General error
        alert('Unable to load your saved addresses. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedAddressId, dispatch]);
  // Open dialog to add new address with useCallback
  const handleAddNewAddress = useCallback(() => {
    const ADDRESS_LIMIT = 3; // Maximum number of allowed addresses
    
    if (addresses.length >= ADDRESS_LIMIT) {
      // Show message that user needs to delete an address first
      alert(`You can have maximum ${ADDRESS_LIMIT} addresses. Please delete an address to add a new one.`);
      return;
    }
    
    setCurrentAddress(null);
    setFormValues({
      ...emptyAddressForm,
      receiverName: user?.name || '',
      receiverPhoneNumber: user?.phoneNumber || '',
      isPrimary: addresses.length === 0 // Set as primary if it's the first address
    });
    setFormErrors({});
    setOpenDialog(true);
  }, [addresses.length, emptyAddressForm, user]);
    // Handle address selection
  const handleSelectAddress = (addressId) => {
    setSelectedAddressId(addressId);
    
    // Also update Redux store with the selected address - this ensures 
    // that form data is always synced with the selected address
    const selectedAddr = addresses.find(addr => addr._id === addressId);
    if (selectedAddr) {
      const addressToUse = {
        addressLine1: selectedAddr.addressLine1,
        addressLine2: selectedAddr.addressLine2 || '',
        city: selectedAddr.city,
        state: selectedAddr.state,
        pincode: selectedAddr.pincode,
        country: selectedAddr.country || 'India',
      };
      
      // Update form values and Redux in sync
      dispatch(setAddressDetails(addressToUse));
      
      // Also validate pincode if available
      if (validatePincode && selectedAddr.pincode) {
        validatePincode(selectedAddr.pincode);
      }
    }
  };// Handle confirm address selection with useCallback
  const handleConfirmAddress = useCallback(() => {
    const selectedAddress = addresses.find(addr => addr._id === selectedAddressId);
    if (selectedAddress && onSelectAddress) {
      try {
        // Always use the most recent or primary address for prefill
        const addressToUse = {
          addressLine1: selectedAddress.addressLine1,
          addressLine2: selectedAddress.addressLine2 || '',
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
          country: selectedAddress.country || 'India',
        };
        
        // Update Redux store with the selected address
        dispatch(setAddressDetails(addressToUse));
        
        // Set as prefilled - this ensures the address form is populated correctly 
        // even after navigating elsewhere and coming back
        dispatch(setPrefilledAddress(addressToUse));
        
        // Validate pincode for serviceability if needed
        if (validatePincode && selectedAddress.pincode) {
          validatePincode(selectedAddress.pincode);
        }
        
        // Call the callback with the selected address
        onSelectAddress(selectedAddress);
      } catch (error) {
        console.error('Error selecting address:', error);
        // Show an error message to the user
        alert('There was an error selecting this address. Please try again.');
        // If there's an error, still try to go back
        if (onBack) {
          onBack();
        }
      }
    } else if (!selectedAddress && addresses.length > 0) {
      // No address selected but we have addresses
      alert('Please select a delivery address to continue');
    } else if (onBack) {
      // If no address is selected or no callback is provided, just go back
      onBack();
    }
  }, [addresses, selectedAddressId, onSelectAddress, onBack, dispatch, validatePincode]);
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
    
    // Sync with Redux - Update address details in real-time while filling out the form
    // This ensures partial address data is always saved even if the user doesn't complete the form
    if (['addressLine1', 'addressLine2', 'city', 'state', 'pincode'].includes(name)) {
      dispatch(setAddressDetails({ [name]: value }));
    }
  };
  
  // Toggle primary address
  const handlePrimaryToggle = (e) => {
    setFormValues(prev => ({
      ...prev,
      isPrimary: e.target.checked
    }));
  };
  
  // Auto-fill user data on form open
  useEffect(() => {
    if (openDialog && !currentAddress && user) {
      setFormValues(prev => ({
        ...prev,
        receiverName: user.name || prev.receiverName,
        receiverPhoneNumber: user.phoneNumber || prev.receiverPhoneNumber
      }));
    }
  }, [openDialog, currentAddress, user]);
  
  
  // Open dialog to edit address
  const handleEditAddress = (address, e) => {
    e.stopPropagation(); // Prevent selecting the address
    
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
  const handleDeleteAddress = async (addressId, e) => {
    e.stopPropagation(); // Prevent selecting the address
    
    // Show confirmation
    if (!confirm('Are you sure you want to delete this address?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Find if this was a primary address before deleting
      const addressToDelete = addresses.find(addr => addr._id === addressId);
      const wasPrimary = addressToDelete?.isPrimary || false;
      
      // Make API call to delete the address
      await axios.delete(`/api/user/addresses/${addressId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Remove the address from local state first for immediate UI feedback
      const updatedAddresses = addresses.filter(addr => addr._id !== addressId);
      setAddresses(updatedAddresses);
      
      // If deleted address was selected, select another one if available
      if (addressId === selectedAddressId) {
        // Try to select another primary address first, or the first available address
        const newSelectedAddress = updatedAddresses.find(addr => addr.isPrimary) || 
                                  updatedAddresses[0] || null;
        
        setSelectedAddressId(newSelectedAddress?._id || null);
      }
      
      // If the deleted address was primary and we have other addresses,
      // make another one primary via API
      if (wasPrimary && updatedAddresses.length > 0) {
        const newPrimaryAddress = updatedAddresses[0];
        try {
          await axios.put(`/api/user/addresses/${newPrimaryAddress._id}`, 
            { ...newPrimaryAddress, isPrimary: true },
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );
          
          // Update local state to reflect the new primary address
          setAddresses(prev => 
            prev.map(addr => 
              addr._id === newPrimaryAddress._id 
                ? { ...addr, isPrimary: true } 
                : addr
            )
          );
        } catch (error) {
          console.error('Failed to set new primary address:', error);
        }
      }
      
      // Fully refresh addresses to ensure consistency
      await loadAddresses();
      
    } catch (error) {
      console.error('Failed to delete address:', error);
      alert('There was a problem deleting your address. Please try again.');
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
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const payload = { ...formValues };
      let response;
      
      // Display optimistic UI update
      let tempId = null;
      if (!currentAddress) {
        // For new addresses, create a temporary ID for optimistic UI
        tempId = 'temp_' + Date.now();
        
        // Add to local state immediately for a more responsive feel
        const newTempAddress = {
          _id: tempId,
          ...payload
        };
        setAddresses(prev => [...prev, newTempAddress]);
        // If it's the first address, select it automatically
        if (addresses.length === 0) {
          setSelectedAddressId(tempId);
        }
      }
      
      if (currentAddress) {
        // Update existing address
        response = await axios.put(`/api/user/addresses/${currentAddress._id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // If this address is being set as primary and it wasn't before,
        // we need to update all addresses to reflect the change
        if (payload.isPrimary && !currentAddress.isPrimary) {
          // Optimistic UI update - make this address primary and others non-primary
          setAddresses(prev => 
            prev.map(addr => ({
              ...addr,
              isPrimary: addr._id === currentAddress._id 
            }))
          );
          
          // Then do a full refresh to ensure consistency
          await loadAddresses();
        } else {
          // Just update this address in the local state to avoid full reload
          setAddresses(prev => 
            prev.map(addr => 
              addr._id === currentAddress._id 
                ? { ...addr, ...payload } 
                : payload.isPrimary && addr.isPrimary
                  ? { ...addr, isPrimary: false } 
                  : addr
            )
          );
        }
      } else {
        // Add new address
        response = await axios.post('/api/user/addresses', payload, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Get the newly created address from the response
        const newAddress = response.data.address;
        
        if (newAddress) {
          // Replace the temporary address with the real one
          setAddresses(prev => 
            prev.map(addr => 
              addr._id === tempId ? newAddress : addr
            )
          );
          
          // If this was selected or is the only address, select it properly
          if (selectedAddressId === tempId || addresses.length === 1) {
            setSelectedAddressId(newAddress._id);
          }
        } else {
          // If we didn't get the new address in the response, do a full refresh
          await loadAddresses();
        }
        
        // If this is the first address or set as primary, select it automatically
        if (addresses.length === 0 || payload.isPrimary) {
          // We have to find the new address in the updated addresses
          const updatedAddresses = await fetchAddresses();
          const createdAddress = updatedAddresses.find(addr => 
            addr.addressLine1 === payload.addressLine1 &&
            addr.city === payload.city &&
            addr.pincode === payload.pincode
          );
          
          if (createdAddress) {
            setSelectedAddressId(createdAddress._id);
          }
        }
      }
      
      setOpenDialog(false);
      
    } catch (error) {
      console.error('Failed to save address:', error);
      // Remove temporary address if the API call failed
      if (!currentAddress) {
        setAddresses(prev => prev.filter(addr => !addr._id.startsWith('temp_')));
      }
      alert('There was a problem saving your address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Helper function to fetch addresses without updating state
  const fetchAddresses = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        return [];
      }
      
      const response = await axios.get('/api/user/addresses', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return response.data.addresses || [];
    } catch (error) {
      console.error('Error fetching addresses:', error);
      return [];
    }
  };
  // Format address for display
  const formatAddress = (address) => {
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.city,
      address.state,
      address.pincode
    ].filter(Boolean);
    
    return parts.join(', ');
  };
    // Handle back button click with useCallback for optimization
  const handleBackClick = useCallback(() => {
    if (typeof onBack === 'function') {
      onBack();
    } else {
      console.warn('No back handler provided to SavedAddressesManager');
    }
  }, [onBack]);
  
  return (
    <AddressContainer>
      {/* Back button and header */}
      <Box display="flex" alignItems="center" width="100%" mb={2}>
        <IconButton onClick={handleBackClick} sx={{ padding: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" ml={1} fontFamily="'Jost', sans-serif">
          {addresses.length > 0 ? 'Select Delivery Address' : 'Add Delivery Address'}
        </Typography>
      </Box>
      
   
        {isLoading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>          {/* Address list */}
          {addresses.length > 0 ? (
            <AddressList>
              <AnimatePresence mode="popLayout">
                {addresses.slice(0, showAllAddresses ? addresses.length : 1).map((address) => (
                  <motion.div 
                    key={address._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    layout
                  >
                    <AddressCard 
                      selected={address._id === selectedAddressId}
                      onClick={() => handleSelectAddress(address._id)}
                      elevation={address._id === selectedAddressId ? 2 : 1}
                    >
                      {address.isPrimary && (
                        <PrimaryBadge>
                          DEFAULT
                        </PrimaryBadge>
                      )}
                      
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box display="flex" alignItems="flex-start">
                          <Radio
                            checked={address._id === selectedAddressId}
                            onChange={() => handleSelectAddress(address._id)}
                            color="primary"
                            sx={{ pt: 0 }}
                          />
                          <Box ml={1} mt={0.5}>
                            <Typography variant="subtitle1" fontWeight={600} fontFamily="'Jost', sans-serif">
                              {address.receiverName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              {address.receiverPhoneNumber}
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ lineHeight: 1.5, maxWidth: '280px' }}
                            >
                              {formatAddress(address)}
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Box>
                          <IconButton 
                            size="small" 
                            onClick={(e) => handleEditAddress(address, e)}
                            sx={{ 
                              color: 'text.secondary',
                              '&:hover': { color: 'primary.main' }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={(e) => handleDeleteAddress(address._id, e)}
                            sx={{ 
                              color: 'text.secondary',
                              '&:hover': { color: 'error.main' }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </AddressCard>
                  </motion.div>
                ))}              </AnimatePresence>
              
              {/* Show all / Show less toggle button - only show if we have more than 1 address */}
              {addresses.length > 1 && (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    mt: 1, 
                    mb: 1 
                  }}
                >
                  <Button
                    variant="text"
                    color="primary"
                    onClick={() => setShowAllAddresses(prev => !prev)}
                    size="small"
                    sx={{ 
                      textTransform: 'none', 
                      fontSize: '0.85rem',
                      fontFamily: "'Jost', sans-serif"
                    }}
                    startIcon={showAllAddresses ? null : <AddIcon fontSize="small" />}
                  >
                    {showAllAddresses ? 'Show Less' : `Show All Addresses (${addresses.length})`}
                  </Button>
                </Box>
              )}
            </AddressList>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 4,
                mb: 2,
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px dashed',
                borderColor: 'divider'
              }}
            >
              <LocationOnIcon sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" fontFamily="'Jost', sans-serif" gutterBottom>
                No addresses saved yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                Add a new address to continue with your order
              </Typography>
            </Box>
          )}
          
          {/* Add new address button */}
          <AddButton 
            variant="outlined" 
            startIcon={<AddIcon />}
            onClick={handleAddNewAddress}
            fullWidth
            disabled={addresses.length >= ADDRESS_LIMIT}
            sx={{ borderRadius: '8px', textTransform: 'none', mt: 2 }}
          >
            {addresses.length >= ADDRESS_LIMIT 
              ? 'Address Limit Reached (5)' 
              : 'Add New Address'
            }
          </AddButton>
          
          {/* Confirm button */}
          {addresses.length > 0 && (
            <Button
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              disabled={!selectedAddressId}
              onClick={handleConfirmAddress}
              sx={{ 
                mt: 2,
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '8px',
                py: 1.2,
                textTransform: 'none',
                fontFamily: "'Jost', sans-serif"
              }}
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
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            overflow: 'visible'
          }
        }}
      >
        <Box position="relative">
          <DialogTitle 
            sx={{ 
              pb: 1, 
              fontFamily: "'Jost', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 600,
              pt: 3,
              px: 3
            }}
          >
            {currentAddress ? 'Edit Delivery Address' : 'Add New Address'}
          </DialogTitle>
          
          <Divider />
          
          <StyledDialogContent>
            <Grid container spacing={2.5}>
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
                  variant="outlined"
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      fontFamily: "'Jost', sans-serif",
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                      }
                    }
                  }}
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
                  variant="outlined"
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      fontFamily: "'Jost', sans-serif",
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                      }
                    }
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
                  placeholder="House/Flat No, Building Name, Street"
                  variant="outlined"
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      fontFamily: "'Jost', sans-serif",
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                      }
                    }
                  }}
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
                  placeholder="Area, Colony, Landmark"
                  variant="outlined"
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      fontFamily: "'Jost', sans-serif",
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                      }
                    }
                  }}
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
                  variant="outlined"
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      fontFamily: "'Jost', sans-serif",
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                      }
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={indianStates}
                  getOptionLabel={(option) => option}
                  value={formValues.state || null}
                  onChange={(event, newValue) => {
                    setFormValues(prev => ({
                      ...prev,
                      state: newValue || ''
                    }));
                    
                    // Clear error if set
                    if (formErrors.state) {
                      setFormErrors(prev => ({
                        ...prev,
                        state: ''
                      }));
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="State"
                      error={!!formErrors.state}
                      helperText={formErrors.state || ''}
                      fullWidth
                      variant="outlined"
                      InputProps={{
                        ...params.InputProps,
                        sx: {
                          borderRadius: '8px',
                          fontFamily: "'Jost', sans-serif",
                          '&.Mui-focused': {
                            boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                          }
                        }
                      }}
                    />
                  )}
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
                  variant="outlined"
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      fontFamily: "'Jost', sans-serif",
                      '&.Mui-focused': {
                        boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                      }
                    }
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
                  variant="outlined"
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                      fontFamily: "'Jost', sans-serif",
                      backgroundColor: (theme) => theme.palette.grey[50],
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Radio
                      checked={formValues.isPrimary}
                      onChange={(e) => setFormValues({...formValues, isPrimary: e.target.checked})}
                      disabled={isSubmitting}
                      color="primary"
                      sx={{
                        '&.Mui-checked': {
                          color: '#1976d2',
                        }
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ fontFamily: "'Jost', sans-serif", fontWeight: 500 }}>
                      Set as default address
                    </Typography>
                  }
                  sx={{ mt: 1 }}
                />
              </Grid>
            </Grid>
          </StyledDialogContent>
          
          <Box sx={{ bgcolor: (theme) => theme.palette.grey[50], borderTop: '1px solid', borderColor: 'divider', p: 2.5, borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button 
                onClick={() => setOpenDialog(false)} 
                disabled={isSubmitting}
                variant="outlined"
                sx={{ 
                  fontFamily: "'Jost', sans-serif",
                  borderRadius: '8px',
                  px: 3,
                  textTransform: 'none',
                  fontWeight: 500
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitAddress}
                variant="contained" 
                color="primary"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
                sx={{ 
                  fontFamily: "'Jost', sans-serif",
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: '8px',
                  px: 3,
                  py: 1,
                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.25)',
                  '&:hover': {
                    boxShadow: '0 6px 16px rgba(25, 118, 210, 0.35)',
                  }
                }}
              >
                {isSubmitting ? 'Saving...' : 'Save Address'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Dialog>
    </AddressContainer>
  );
};

export default SavedAddressesManager;
