import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';

import { serviceCatalog } from '../data/publicContent.js';
import khatuLogo from '../assets/khatulogo-removebg-preview.png';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/features', label: 'Services' },
  { to: '/help-center', label: 'Help' },
  { to: '/contact', label: 'Contact' },
];

export default function PublicNavbar() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
    setServicesOpen(false);
  }, [location.pathname]);

  const topServices = useMemo(() => serviceCatalog.slice(0, 6), []);
  const isServiceRoute = location.pathname.startsWith('/services') || location.pathname === '/features';
  const isActive = (path) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));

  return (
    <nav className={`public-nav ${isScrolled ? 'scrolled' : ''}`}>
      <div className="public-nav-inner">
        <Link to="/" className="public-brand" aria-label="Khatu Pay home">
          <img src={khatuLogo} alt="Khatu Pay" />
        </Link>

        <div className="public-nav-links">
          {navLinks.map((link) => {
            if (link.to === '/features') {
              return (
                <div
                  key={link.to}
                  className="services-menu"
                  onMouseEnter={() => setServicesOpen(true)}
                  onMouseLeave={() => setServicesOpen(false)}
                >
                  <Link
                    to={link.to}
                    className={`nav-link ${isServiceRoute ? 'active' : ''}`}
                    onFocus={() => setServicesOpen(true)}
                  >
                    {link.label} <ChevronDown size={15} />
                  </Link>
                  {servicesOpen && (
                    <div className="services-dropdown">
                      <div className="services-dropdown-head">
                        <strong>Khatu Pay Services</strong>
                        <span>Choose an available or upcoming service</span>
                      </div>
                      <div className="services-dropdown-grid">
                        {topServices.map((service) => {
                          const Icon = service.icon;
                          return (
                            <Link key={service.slug} to={`/services/${service.slug}`} className="service-mini-link">
                              <span style={{ background: `${service.color}18`, color: service.color }}>
                                <Icon size={18} />
                              </span>
                              <div>
                                <strong>{service.title}</strong>
                                <small>{service.status}</small>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link key={link.to} to={link.to} className={`nav-link ${isActive(link.to) ? 'active' : ''}`}>
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="public-nav-actions">
          <button
            className="mobile-menu-button"
            type="button"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="mobile-drawer">
          <div className="mobile-drawer-card">
            <div className="mobile-drawer-section">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`mobile-link ${isActive(link.to) || (link.to === '/features' && isServiceRoute) ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mobile-drawer-section">
              <div className="mobile-section-title">Popular Services</div>
              <div className="mobile-services-grid">
                {topServices.slice(0, 4).map((service) => {
                  const Icon = service.icon;
                  return (
                    <Link key={service.slug} to={`/services/${service.slug}`} className="mobile-service-card">
                      <Icon size={18} />
                      <span>{service.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .public-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(226, 232, 240, 0.9);
          font-family: 'Segoe UI', system-ui, sans-serif;
          transition: box-shadow 0.2s ease, background 0.2s ease;
        }

        .public-nav.scrolled {
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
        }

        .public-nav-inner {
          max-width: 1220px;
          margin: 0 auto;
          height: 76px;
          padding: 0 22px;
          display: grid;
          grid-template-columns: 104px 1fr 72px;
          align-items: center;
          gap: 18px;
        }

        .public-brand {
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          text-decoration: none;
          color: #0f172a;
          width: 92px;
          height: 68px;
        }

        .public-brand img {
          width: 86px;
          height: 86px;
          object-fit: contain;
        }

        .public-nav-links {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 40px;
          padding: 9px 16px;
          border-radius: 999px;
          color: #334155;
          text-decoration: none;
          font-size: 14px;
          font-weight: 800;
          white-space: nowrap;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .nav-link:hover,
        .nav-link.active {
          background: #ecfdf7;
          color: #0f766e;
        }

        .services-menu {
          position: relative;
          padding: 10px 0;
          margin: -10px 0;
        }

        .services-dropdown {
          position: absolute;
          top: 100%;
          left: 50%;
          width: min(620px, 90vw);
          transform: translateX(-50%);
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.14);
          padding: 16px;
          animation: navDrop 0.18s ease;
        }

        .services-dropdown::before {
          content: '';
          position: absolute;
          top: -8px;
          left: 50%;
          width: 16px;
          height: 16px;
          transform: translateX(-50%) rotate(45deg);
          background: #ffffff;
          border-left: 1px solid #e2e8f0;
          border-top: 1px solid #e2e8f0;
        }

        .services-dropdown-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 4px 12px;
          border-bottom: 1px solid #eef2f7;
        }

        .services-dropdown-head strong {
          color: #0f172a;
          font-size: 15px;
        }

        .services-dropdown-head span {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .services-dropdown-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .service-mini-link {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 10px;
          align-items: center;
          padding: 10px;
          border-radius: 14px;
          text-decoration: none;
          color: #0f172a;
          border: 1px solid transparent;
        }

        .service-mini-link:hover {
          background: #f8fafc;
          border-color: #e2e8f0;
        }

        .service-mini-link > span {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .service-mini-link strong,
        .service-mini-link small {
          display: block;
        }

        .service-mini-link strong {
          font-size: 14px;
          font-weight: 900;
        }

        .service-mini-link small {
          margin-top: 2px;
          color: #64748b;
          font-weight: 800;
          font-size: 12px;
        }

        .public-nav-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .mobile-menu-button {
          display: none;
          width: 44px;
          height: 44px;
          border: 1px solid #d8e7e4;
          border-radius: 999px;
          color: #0f172a;
          background: #ffffff;
          align-items: center;
          justify-content: center;
        }

        .mobile-drawer {
          display: none;
        }

        @keyframes navDrop {
          from { opacity: 0; transform: translate(-50%, -6px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        @keyframes drawerIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1020px) {
          .public-nav-links {
            display: none;
          }

          .public-nav-actions {
            min-width: auto;
          }

          .mobile-menu-button {
            display: inline-flex;
          }

          .mobile-drawer {
            display: block;
            border-top: 1px solid #e2e8f0;
            background: rgba(247, 251, 250, 0.98);
            padding: 12px;
            animation: drawerIn 0.18s ease;
          }

          .mobile-drawer-card {
            max-width: 1220px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 22px;
            padding: 14px;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10);
          }

          .mobile-drawer-section {
            display: grid;
            gap: 8px;
          }

          .mobile-drawer-section + .mobile-drawer-section {
            margin-top: 14px;
            padding-top: 14px;
            border-top: 1px solid #eef2f7;
          }

          .mobile-link {
            text-decoration: none;
            color: #334155;
            background: #f7fbfa;
            border-radius: 16px;
            padding: 13px 14px;
            font-weight: 900;
          }

          .mobile-link.active {
            background: #ecfdf7;
            color: #0f766e;
          }

          .mobile-section-title {
            color: #64748b;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .mobile-services-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .mobile-service-card {
            min-height: 54px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px;
            border-radius: 13px;
            background: #f7fbfa;
            color: #0f172a;
            text-decoration: none;
            font-size: 13px;
            font-weight: 900;
          }

        }

        @media (max-width: 560px) {
          .public-nav-inner {
            height: 70px;
            padding: 0 14px;
            grid-template-columns: 82px 1fr 50px;
          }

          .public-brand {
            width: 76px;
            height: 60px;
          }

          .public-brand img {
            width: 74px;
            height: 74px;
          }

          .mobile-services-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </nav>
  );
}
