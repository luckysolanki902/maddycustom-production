// app/error.js
"use client"
import Link from 'next/link';

const NotFoundPage = () => {
  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Page Not Found</h1>
      <p style={styles.paragraph}>The page you were looking for could not be found. Please return to the home page or enter correct url</p>
      <Link href="/" className='errorbutton'>
        Go to Home
      </Link>
    </div>
  );
};

const styles = {
  container: {
    textAlign: 'center',
    marginTop: '50px',
  },
  heading: {
    fontSize: '2rem',
    color: '#333',
  },
  paragraph: {
    fontSize: '1rem',
    color: '#555',
    marginBottom: '20px',
  },
  button: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: 'rgb(70, 70, 70)',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '0.7rem',
    fontSize: '1.2rem',
    transition: 'background-color 0.3s, color 0.3s',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: '#333',
      color: '#fff',
      scale:'0.95'
    },
  },
};

export default NotFoundPage;
