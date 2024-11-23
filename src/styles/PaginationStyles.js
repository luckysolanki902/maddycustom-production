import { styled } from '@mui/system';

export const PaginationStyles = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  marginBottom: '2rem',
  marginTop: '2rem',
  '& .MuiPaginationItem-root': {
    color: 'black',
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
  },
});
