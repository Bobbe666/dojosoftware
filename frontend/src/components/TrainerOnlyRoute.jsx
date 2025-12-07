import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const TrainerOnlyRoute = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is trainer (rolle = 'eingeschraenkt' with checkin/anwesenheit permissions)
  const isTrainer = user?.rolle === 'eingeschraenkt' ||
                    user?.username === 'TrainerloginTDA' ||
                    (user?.berechtigungen && (user.berechtigungen.checkin || user.berechtigungen.anwesenheit));

  if (!isTrainer) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default TrainerOnlyRoute;
