import React from 'react';
import FeatureGate from '../components/FeatureGate';
import Lernplattform from '../components/Lernplattform';

const LernplattformPage = () => (
  <FeatureGate feature="lernplattform" showLockedPreview={true}>
    <Lernplattform />
  </FeatureGate>
);

export default LernplattformPage;
