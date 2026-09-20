import React from 'react';
import { Navigate } from 'react-router-dom';
import { getTokens } from '../api/axios.js';

const ProtectedRoute = ({ children }) => {
  const tokens = getTokens();
  if (!tokens?.accessToken) {
    localStorage.removeItem('kp_tokens');
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default ProtectedRoute;
