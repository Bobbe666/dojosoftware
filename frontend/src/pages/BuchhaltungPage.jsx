import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import FeatureGate from '../components/FeatureGate';
import BuchhaltungTab from '../components/BuchhaltungTab';

const BuchhaltungPage = () => {
  const { token } = useAuth();

  return (
    <FeatureGate feature="buchfuehrung" showLockedPreview={true}>
      <BuchhaltungTab token={token} dojoMode={true} />
    </FeatureGate>
  );
};

export default BuchhaltungPage;
