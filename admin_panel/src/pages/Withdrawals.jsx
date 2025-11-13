import { useState, useEffect } from 'react';
import axios from '../api/axios';

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    try {
      const response = await axios.get('/admin/withdrawals');
      setWithdrawals(response.data.items || []);
    } catch (error) {
      console.error('Error loading withdrawals:', error);
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (id, decision, txnId = '', notes = '') => {
    try {
      await axios.post(`/admin/withdrawals/${id}/decision`, {
        decision,
        txnId,
        notes,
      });
      loadWithdrawals();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      alert('Error processing withdrawal');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Withdrawal Requests</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bank Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {withdrawals.map((withdrawal) => (
              <tr key={withdrawal._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {withdrawal.userId?.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {withdrawal.userId?.email}
                  </div>
                  <div className="text-sm text-gray-500">
                    Mobile: {withdrawal.userId?.mobile}
                  </div>
                  <div className="text-sm text-gray-500">
                    Loan Limit: ₹{withdrawal.userId?.loanLimit?.amount || withdrawal.userId?.loanLimit || 0}
                  </div>
                  <div className="text-sm text-gray-500">
                    Wallet Balance: ₹{withdrawal.userId?.walletBalance || 0}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ₹{withdrawal.amount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>Bank: {withdrawal.bankDetails?.bankName}</div>
                  <div>Account: {withdrawal.bankDetails?.accountNumber}</div>
                  <div>IFSC: {withdrawal.bankDetails?.ifscCode}</div>
                  <div>Holder: {withdrawal.bankDetails?.accountHolderName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(withdrawal.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    withdrawal.status === 'APPROVED'
                      ? 'bg-green-100 text-green-800'
                      : withdrawal.status === 'REJECTED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {withdrawal.status}
                  </span>
                  {withdrawal.txnId && (
                    <div className="text-xs text-gray-500 mt-1">
                      Txn: {withdrawal.txnId}
                    </div>
                  )}
                  {withdrawal.notes && (
                    <div className="text-xs text-gray-500 mt-1">
                      Notes: {withdrawal.notes}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {withdrawal.status === 'PENDING' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          const txnId = prompt('Enter transaction ID:');
                          if (txnId) handleDecision(withdrawal._id, 'APPROVED', txnId);
                        }}
                        className="text-green-600 hover:text-green-900"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const notes = prompt('Enter rejection notes:');
                          handleDecision(withdrawal._id, 'REJECTED', '', notes);
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Withdrawals;
