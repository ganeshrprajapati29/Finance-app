import React from 'react';
import { Navigate } from 'react-router-dom';

const EmployeeProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('kp_employee_tokens');
  if (!token) {
    return <Navigate to="/employee/login" replace />;
  }
  return children;
};

export default EmployeeProtectedRoute;
