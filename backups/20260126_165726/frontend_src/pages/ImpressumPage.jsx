import React from 'react';
import { useForceDarkTheme } from '../context/ThemeContext';

const ImpressumPage = () => {
  useForceDarkTheme();
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Impressum</h1>
      <p>Diese Seite ist in Entwicklung.</p>
    </div>
  );
};

export default ImpressumPage;
