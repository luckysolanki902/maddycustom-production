export const getCookie = (name) => {
    if (typeof window === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
    return null;
  };
  
  export const getFbp = () => getCookie('_fbp');
  export const getFbc = () => getCookie('fbc'); 
 