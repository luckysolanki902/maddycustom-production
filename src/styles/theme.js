// theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#000000', // Set primary color to black
    },
  },
  typography: {
    fontFamily: 'Jost, sans-serif', // Apply Jost font globally
    fontSize: 16, // Set a base font size; adjust as needed
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          fontFamily: 'Jost, sans-serif', // Apply Jost font to every element
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: 'black', // Label color
          textTransform: 'capitalize', // Capitalize the first letter
          fontSize: '1rem', // Adjust label font size
          '&.Mui-focused': {
            color: 'black', // Label color when focused
          },
        },
      },
    },
    MuiInput: {
      styleOverrides: {
        underline: {
          '&:before': {
            borderBottomColor: 'black', // Default underline color
          },
          '&:after': {
            borderBottomColor: 'black', // Underline color when focused
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& fieldset': {
            borderColor: 'black', // Outline border color
          },
          '&:hover fieldset': {
            borderColor: 'black', // Outline border color on hover
          },
          '&.Mui-focused fieldset': {
            borderColor: 'black', // Outline border color when focused
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: 'black', // Indicator color
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: 'black', // Tab label color
          textTransform: 'capitalize', // Capitalize first letter for tabs
          fontSize: '1.3rem', // Adjust tab font size
          '&.Mui-selected': {
            color: 'black', // Selected tab label color
            fontWeight: '500',
          },
        },
      },
    },
  },
});

export default theme;
