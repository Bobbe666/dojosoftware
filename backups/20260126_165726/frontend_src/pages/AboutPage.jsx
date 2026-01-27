import React from 'react';
import { useForceDarkTheme } from '../context/ThemeContext';

const AboutPage = () => {
  useForceDarkTheme();
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Über uns</h1>
      <p>Diese Seite ist in Entwicklung.</p>
    </div>
  );
};

export default AboutPage;
