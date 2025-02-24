import { styled } from '@mui/system';

export const PaginationStyles = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  marginBottom: '2rem',
  marginTop: '2rem',
  '& .MuiPaginationItem-root': {
    color: 'black',
    height: '32px',
    minWidth: '32px',
    backgroundColor: 'white',
    border: '1px solid black',
    margin: '0.5rem',
    borderRadius: '50%',
    transition: 'background-color 0.3s, color 0.3s',
    '&:hover': {
      backgroundColor: 'black',
      color: 'white',
    },
    '&.Mui-selected': {
      backgroundColor: 'black',
      color: 'white',
    },
    '&.Mui-selected:hover': {
      backgroundColor: 'black',
      color: 'white',
    },
  },
  '& .MuiPaginationItem-ellipsis': {
    border: 'none',
    boxSizing: 'border-box',
    boxShadow: 'none',
    margin:'0',
    backgroundColor: 'transparent',
  },
  '& .MuiPaginationItem-ellipsis:hover': {
    backgroundColor: 'transparent',
    border: 'none',
    boxShadow: 'none',
    color: 'black',
  },
});

export const PaginationStylesForPhone = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  marginBottom: '1.5rem',
  marginTop: '1.5rem',
  '& .MuiPaginationItem-root': {
    color: 'black',
    fontSize: '0.8rem',
    height: '25px',
    minWidth: '25px',
    backgroundColor: 'white',
    border: '1px solid black',
    margin: '0.3rem',
    borderRadius: '50%',
    transition: 'background-color 0.3s, color 0.3s',
    '&:hover': {
      backgroundColor: 'black',
      color: 'white',
    },
    '&.Mui-selected': {
      backgroundColor: 'black',
      color: 'white',
    },
    '&.Mui-selected:hover': {
      backgroundColor: 'black',
      color: 'white',
    },
  },
  '& .MuiPaginationItem-ellipsis': {
    border: 'none',
    boxSizing: 'border-box',
    boxShadow: 'none',
    margin:'0',
    padding:'0',
    backgroundColor: 'transparent',
  },
  '& .MuiPaginationItem-ellipsis:hover': {
    backgroundColor: 'transparent',
    border: 'none',
    boxShadow: 'none',
    color: 'black',
  },
});