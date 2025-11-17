import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

const TrackLoan = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loanData, setLoanData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setError('Please enter a loan account number or email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.get(`/admin/track-loan/search?query=${encodeURIComponent(searchQuery)}`);
      setLoanData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Loan not found');
      setLoanData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getStatusColor = (status) => {
    const colors = {
      'PENDING': { backgroundColor: '#fef3c7', color: '#92400e' },
      'APPROVED': { backgroundColor: '#dbeafe', color: '#1e40af' },
      'REJECTED': { backgroundColor: '#fee2e2', color: '#dc2626' },
      'DISBURSED': { backgroundColor: '#dcfce7', color: '#166534' },
      'CLOSED': { backgroundColor: '#f3f4f6', color: '#374151' },
      'PAID': { backgroundColor: '#dcfce7', color: '#166534' },
      'OVERDUE': { backgroundColor: '#fee2e2', color: '#dc2626' }
    };
    return colors[status] || { backgroundColor: '#f3f4f6', color: '#374151' };
  };

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '8px'
        }}>Track Loan</h1>
        <p style={{
          color: '#6b7280',
          fontSize: '16px'
        }}>Search and monitor loan details by account number or email</p>
      </div>

      {/* Search Form */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter loan account number or user email"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (!loading) e.target.style.backgroundColor = '#1d4ed8';
            }}
            onMouseOut={(e) => {
              if (!loading) e.target.style.backgroundColor = '#2563eb';
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #ffffff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Searching...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </>
            )}
          </button>
        </form>

        {error && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <svg width="20" height="20" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{
              marginLeft: '8px',
              color: '#dc2626',
              fontSize: '14px'
            }}>{error}</span>
          </div>
        )}
      </div>

      {/* Loan Details */}
      {loanData && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            borderBottom: '1px solid #e5e7eb',
            padding: '24px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}>
              <div>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937'
                }}>
                  Loan Account: {loanData.loanAccountNumber}
                </h2>
                <p style={{
                  color: '#6b7280',
                  marginTop: '4px',
                  fontSize: '14px'
                }}>
                  {loanData.user?.name || 'N/A'} • {loanData.user?.email || 'N/A'}
                </p>
              </div>
              <span style={{
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: '500',
                ...getStatusColor(loanData.status)
              }}>
                {loanData.status}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: '1px solid #e5e7eb' }}>
            <nav style={{ display: 'flex' }}>
              {['overview', 'schedule', 'payments', 'overdue'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                    color: activeTab === tab ? '#2563eb' : '#6b7280',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (activeTab !== tab) e.target.style.color = '#374151';
                  }}
                  onMouseOut={(e) => {
                    if (activeTab !== tab) e.target.style.color = '#6b7280';
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '24px' }}>
            {activeTab === 'overview' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '24px'
              }}>
                {/* Loan Summary Cards */}
                <div style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '12px'
                }}>
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: 0.9,
                    marginBottom: '8px'
                  }}>Total Amount</h3>
                  <p style={{
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}>{formatCurrency(loanData.totals?.total)}</p>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '12px'
                }}>
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: 0.9,
                    marginBottom: '8px'
                  }}>Paid Amount</h3>
                  <p style={{
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}>{formatCurrency(loanData.paid?.total)}</p>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '12px'
                }}>
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: 0.9,
                    marginBottom: '8px'
                  }}>Outstanding</h3>
                  <p style={{
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}>{formatCurrency(loanData.outstanding?.total)}</p>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '12px'
                }}>
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: 0.9,
                    marginBottom: '8px'
                  }}>Overdue Amount</h3>
                  <p style={{
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}>{formatCurrency(loanData.overdue?.amount)}</p>
                </div>

                {/* Next Payment Due */}
                {loanData.nextDue && (
                  <div style={{
                    gridColumn: 'span 2',
                    backgroundColor: '#fefce8',
                    border: '1px solid #fde047',
                    padding: '20px',
                    borderRadius: '12px'
                  }}>
                    <h3 style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#92400e',
                      marginBottom: '8px'
                    }}>Next Payment Due</h3>
                    <p style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#78350f'
                    }}>
                      {formatCurrency(loanData.nextDue.total)} on {formatDate(loanData.nextDue.dueDate)}
                    </p>
                  </div>
                )}

                {/* Pay Now Button */}
                <div style={{
                  gridColumn: 'span 2',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <button style={{
                    padding: '12px 24px',
                    backgroundColor: '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#15803d'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#16a34a'}
                  >
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Pay Now
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  minWidth: '100%',
                  borderCollapse: 'collapse'
                }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid #e5e7eb'
                      }}>Installment</th>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid #e5e7eb'
                      }}>Due Date</th>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid #e5e7eb'
                      }}>Amount</th>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid #e5e7eb'
                      }}>Status</th>
                    </tr>
                  </thead>
                  <tbody style={{ backgroundColor: 'white' }}>
                    {loanData.schedule.map((installment, index) => (
                      <tr key={index} style={{
                        backgroundColor: installment.paid ? '#f0fdf4' : new Date(installment.dueDate) < new Date() ? '#fef2f2' : 'white'
                      }}>
                        <td style={{
                          padding: '16px 24px',
                          whiteSpace: 'nowrap',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#111827',
                          borderBottom: '1px solid #e5e7eb'
                        }}>{installment.installmentNo}</td>
                        <td style={{
                          padding: '16px 24px',
                          whiteSpace: 'nowrap',
                          fontSize: '14px',
                          color: '#6b7280',
                          borderBottom: '1px solid #e5e7eb'
                        }}>{formatDate(installment.dueDate)}</td>
                        <td style={{
                          padding: '16px 24px',
                          whiteSpace: 'nowrap',
                          fontSize: '14px',
                          color: '#111827',
                          borderBottom: '1px solid #e5e7eb'
                        }}>{formatCurrency(installment.total)}</td>
                        <td style={{
                          padding: '16px 24px',
                          whiteSpace: 'nowrap',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <span style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            fontWeight: '500',
                            borderRadius: '9999px',
                            ...getStatusColor(installment.paid ? 'PAID' : new Date(installment.dueDate) < new Date() ? 'OVERDUE' : 'PENDING')
                          }}>
                            {installment.paid ? 'Paid' : new Date(installment.dueDate) < new Date() ? 'Overdue' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'payments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '500',
                  color: '#111827'
                }}>Payment History</h3>
                {loanData.recentPayments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loanData.recentPayments.map((payment, index) => (
                      <div key={index} style={{
                        backgroundColor: '#f9fafb',
                        padding: '16px',
                        borderRadius: '8px'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}>
                          <div>
                            <p style={{
                              fontWeight: '500',
                              color: '#111827'
                            }}>
                              {formatCurrency(payment.amount)}
                            </p>
                            <p style={{
                              fontSize: '14px',
                              color: '#6b7280',
                              marginTop: '4px'
                            }}>
                              {formatDate(payment.createdAt)}
                            </p>
                          </div>
                          <span style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            borderRadius: '9999px'
                          }}>
                            {payment.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#6b7280' }}>No payments found</p>
                )}
              </div>
            )}

            {activeTab === 'overdue' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '500',
                  color: '#111827'
                }}>Overdue Installments</h3>
                {loanData.overdue.installments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loanData.overdue.installments.map((installment, index) => (
                      <div key={index} style={{
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        padding: '16px',
                        borderRadius: '8px'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}>
                          <div>
                            <p style={{
                              fontWeight: '500',
                              color: '#dc2626'
                            }}>
                              Installment #{installment.installmentNo}
                            </p>
                            <p style={{
                              fontSize: '14px',
                              color: '#dc2626',
                              marginTop: '4px'
                            }}>
                              Due: {formatDate(installment.dueDate)}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{
                              fontWeight: '500',
                              color: '#dc2626'
                            }}>
                              {formatCurrency(installment.total)}
                            </p>
                            <p style={{
                              fontSize: '14px',
                              color: '#dc2626',
                              marginTop: '4px'
                            }}>
                              {Math.ceil((new Date() - new Date(installment.dueDate)) / (1000 * 60 * 60 * 24))} days overdue
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fca5a5',
                      padding: '16px',
                      borderRadius: '8px'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{
                          fontWeight: '500',
                          color: '#dc2626'
                        }}>Total Overdue Amount:</span>
                        <span style={{
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#dc2626'
                        }}>
                          {formatCurrency(loanData.overdue?.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: '16px',
                    borderRadius: '8px'
                  }}>
                    <p style={{ color: '#166534' }}>No overdue installments</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TrackLoan;
