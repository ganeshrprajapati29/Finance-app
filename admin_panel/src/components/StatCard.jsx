import React from 'react';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, subtitle, color, icon, to }) => {
  const content = (
    <div className="admin-card p-4">
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <div className="text-muted small mb-2">{title}</div>
          <div className="h4 mb-1 fw-bold" style={{ color }}>{value}</div>
          {subtitle && <small className="text-muted">{subtitle}</small>}
        </div>
        {icon && <div className="fs-1 opacity-75">{icon}</div>}
      </div>
    </div>
  );

  return to ? <Link to={to} className="text-decoration-none">{content}</Link> : content;
};

export default StatCard;

