"use client";

import { useEffect, useState } from "react";

const TestPage = () => {
  const [dimensions, setDimensions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDimensionsAndWeight = async () => {
      try {
        const response = await fetch("/api/test/get-dimensions");
        if (!response.ok) {
          throw new Error("Failed to fetch dimensions");
        }
        const data = await response.json();
        setDimensions(data.dimensionsAndWeight);
      } catch (err) {
        setError(err.message);
        console.error(err);
      }
    };

    fetchDimensionsAndWeight();
  }, []);

  return (
    <div>
      <h1>Test Page</h1>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {dimensions ? (
        <pre>{JSON.stringify(dimensions, null, 2)}</pre>
      ) : (
        <p>Loading dimensions...</p>
      )}
    </div>
  );
};

export default TestPage;
