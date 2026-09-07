import React from 'react';

const StatusBadge = ({ status, className = '', children }) => {
  const getStatusClass = (s) => {
    const map = {
      'CONFIRMED': 'status-success',
      'success': 'status-success',
      'PENDING': 'status-warning',
      'pending': 'status-warning',
      'FAILED': 'status-danger',
      'failed': 'status-danger',
      'active': 'status-success',
      'verified': 'status-success',
      'blocked': 'status-danger',
      'rejected': 'status-danger'
    };
    return map[s] || 'status-info';
  };

  return (
    <span className={`status-badge ${getStatusClass(status)} ${className}`}>
      {children || status}
    </span>
  );
};

export default StatusBadge;

