import React from 'react';
import { Card } from 'react-bootstrap';

const NotFound = () => {
  return (
    <div className="container-fluid p-4 text-center">
      <h2 className="mb-4">404 - Page Not Found</h2>
      <Card><Card.Body><p>The page you are looking for does not exist.</p></Card.Body></Card>
    </div>
  );
};

export default NotFound;
