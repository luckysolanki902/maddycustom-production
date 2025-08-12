import { useState, useEffect } from 'react';

export const useCarIntExtProducts = (limit = 6) => {
  const [data, setData] = useState({
    interior: [],
    exterior: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/products/car-interior-exterior?limit=${limit}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch car interior/exterior products');
        }
        
        const result = await response.json();
        
        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.message || 'Failed to fetch products');
        }
      } catch (err) {
        console.error('Error fetching car interior/exterior products:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [limit]);

  return { data, loading, error };
};
