import React from 'react';

import khatuLogo from '../assets/khatulogo-removebg-preview.png';

export default function PremiumLoader() {
  const color = '#0066FF';

  // Floating icons

  const FloatingIcon = ({
    icon,
    delay,
    left,
    duration,
  }) => (
    <div
      style={{
        position: 'absolute',
        left: left,
        top: '-50px',
        fontSize: '38px',
        opacity: 0.06,
        animation: `floatIcon ${duration}s linear infinite`,
        animationDelay: delay,
      }}
    >
      {icon}
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        background:
          'linear-gradient(135deg,#ffffff 0%,#F8FAFC 50%,#ffffff 100%)',

        padding: '40px 20px',
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      {/* BACKGROUND */}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* FLOATING ICONS */}

        <FloatingIcon
          icon="📱"
          delay="0s"
          left="10%"
          duration="6"
        />

        <FloatingIcon
          icon="⚡"
          delay="1s"
          left="22%"
          duration="7"
        />

        <FloatingIcon
          icon="📶"
          delay="2s"
          left="35%"
          duration="8"
        />

        <FloatingIcon
          icon="💡"
          delay="1.5s"
          left="48%"
          duration="7"
        />

        <FloatingIcon
          icon="📺"
          delay="2.2s"
          left="62%"
          duration="8"
        />

        <FloatingIcon
          icon="🚗"
          delay="0.8s"
          left="75%"
          duration="7"
        />

        <FloatingIcon
          icon="✨"
          delay="1.8s"
          left="88%"
          duration="6.5"
        />

        {/* BLOBS */}

        <div
          style={{
            position: 'absolute',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(0,102,255,0.08), transparent)',

            filter: 'blur(80px)',
            top: '-120px',
            left: '-120px',
            animation: 'blobFloat 16s ease-in-out infinite',
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(16,185,129,0.08), transparent)',

            filter: 'blur(80px)',
            bottom: '-120px',
            right: '-120px',
            animation:
              'blobFloat 18s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* MAIN */}

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '45px',
        }}
      >
        {/* LOGO */}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* RING */}

          <div
            style={{
              position: 'absolute',
              width: '180px',
              height: '180px',
              borderRadius: '40px',
              border: `2px solid ${color}25`,
              animation:
                'rotateRing 4s linear infinite',
            }}
          />

          {/* AURA */}

          <div
            style={{
              position: 'absolute',
              width: '160px',
              height: '160px',
              borderRadius: '36px',
              background:
                'radial-gradient(circle, rgba(0,102,255,0.12), transparent)',

              animation:
                'pulseAura 2.5s ease-in-out infinite',
            }}
          />

          {/* CARD */}

          <div
            style={{
              width: '140px',
              height: '140px',
              borderRadius: '28px',
              background: '#ffffff',
              border: '1px solid #E2E8F0',
              boxShadow:
                '0 25px 60px rgba(0,0,0,0.08)',

              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              zIndex: 5,
              animation:
                'floatCard 3.5s ease-in-out infinite',
            }}
          >
            <img
              src={khatuLogo}
              alt="Khatu Pay Logo"
              style={{
                width: '85%',
                height: '85%',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* PARTICLES */}

          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: color,
                animation:
                  'orbitParticle 6s linear infinite',

                transform: `rotate(${
                  i * 90
                }deg) translateX(110px)`,

                transformOrigin: '90px 90px',
                animationDelay: `${i * 1.2}s`,
                boxShadow:
                  '0 0 15px rgba(0,102,255,0.4)',
              }}
            />
          ))}
        </div>

        {/* LOADING */}

        <div
          style={{
            textAlign: 'center',
          }}
        >
          {/* CIRCLE */}

          <div
            style={{
              width: '100px',
              height: '100px',
              margin: '0 auto 30px',
              position: 'relative',
            }}
          >
            <svg
              width="100"
              height="100"
              style={{
                animation:
                  'rotateLoader 3s linear infinite',
              }}
            >
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(0,102,255,0.12)"
                strokeWidth="2"
              />

              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeDasharray="141.4"
                strokeDashoffset="141.4"
                strokeLinecap="round"
                style={{
                  animation:
                    'dashSpin 2.5s ease-in-out infinite',
                }}
              />
            </svg>

            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                color: color,
                fontWeight: 700,
              }}
            >
              ♦
            </div>
          </div>

          {/* TEXT */}

          <h2
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: color,
              marginBottom: '10px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            Loading
          </h2>

          <p
            style={{
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Preparing recharge services
          </p>

          {/* BOTTOM TEXT */}

          <div
            style={{
              marginTop: '30px',
            }}
          >
            <p
              style={{
                color: '#0f172a',
                fontSize: '18px',
                fontWeight: 700,
                marginBottom: '8px',
              }}
            >
              Recharge & Utility Services
            </p>

            <p
              style={{
                color: '#64748b',
                fontSize: '13px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              Secure Digital Platform
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM LINE */}

      <div
        style={{
          position: 'absolute',
          bottom: '5%',
          width: '70%',
          height: '2px',
          borderRadius: '10px',
          background:
            'linear-gradient(90deg, transparent, #0066FF, transparent)',

          animation:
            'lineGlow 3s ease-in-out infinite',
        }}
      />

      {/* STYLE */}

      <style>{`
        @keyframes rotateRing {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulseAura {
          0%,100% {
            transform: scale(1);
          }

          50% {
            transform: scale(1.12);
          }
        }

        @keyframes floatCard {
          0%,100% {
            transform: translateY(0px);
          }

          50% {
            transform: translateY(-16px);
          }
        }

        @keyframes orbitParticle {
          from {
            transform: rotate(0deg) translateX(110px);
          }

          to {
            transform: rotate(360deg) translateX(110px);
          }
        }

        @keyframes rotateLoader {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @keyframes dashSpin {
          0% {
            stroke-dashoffset: 141.4;
          }

          50% {
            stroke-dashoffset: 35.4;
          }

          100% {
            stroke-dashoffset: 141.4;
          }
        }

        @keyframes lineGlow {
          0%,100% {
            opacity: 0.4;
          }

          50% {
            opacity: 1;
          }
        }

        @keyframes blobFloat {
          0%,100% {
            transform: translate(0,0);
          }

          50% {
            transform: translate(30px,-30px);
          }
        }

        @keyframes floatIcon {
          0% {
            transform: translateY(0px);
            opacity: 0.06;
          }

          50% {
            opacity: 0.1;
          }

          100% {
            transform: translateY(100vh);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}