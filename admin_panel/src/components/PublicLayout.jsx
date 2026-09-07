import React from 'react';
import { Outlet } from 'react-router-dom';
import PublicNavbar from './PublicNavbar.jsx';
import PublicFooter from './PublicFooter.jsx';

export default function PublicLayout() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: '#ffffff'
    }}>
      <PublicNavbar />
      
      <main style={{ 
        flex: 1, 
        paddingTop: '74px',
        paddingBottom: '42px',
        overflow: 'auto'
      }}>
        <div style={{ 
          maxWidth: '1220px', 
          margin: '0 auto', 
          padding: '0 22px' 
        }}>
          <Outlet />
        </div>
      </main>
      
      <PublicFooter />
      
      <style>{`
        /* Ensure smooth scrolling */
        html {
          scroll-behavior: smooth;
        }
        
        /* Custom scrollbar for main content */
        main::-webkit-scrollbar {
          width: 8px;
        }
        
        main::-webkit-scrollbar-track {
          background: #f1f5f9;
          borderRadius: 10px;
        }
        
        main::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #0066FF, #00B366);
          borderRadius: 10px;
        }
        
        main::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #0052CC, #00994D);
        }
        
        /* Responsive padding */
        @media (max-width: 768px) {
          main {
            paddingTop: 66px !important;
            paddingBottom: 30px !important;
          }
          main > div {
            paddingLeft: 14px !important;
            paddingRight: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
