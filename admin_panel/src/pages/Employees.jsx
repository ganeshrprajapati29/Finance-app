import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { toast } from 'react-toastify';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    permissions: {
      canManageUsers: false,
      canManageLoans: false,
      canManagePayments: false,
      canManageSupport: true,
      canSendNotifications: false,
      canViewAudit: false,
      canManageSettings: false,
    },
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/employees');
      setEmployees(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error('Failed to fetch employees');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await axios.put(`/employees/${editingEmployee._id}`, formData);
        toast.success('Employee updated successfully');
      } else {
        const response = await axios.post('/employees', formData);
        toast.success('Employee created successfully');
        // Show employee login credentials
        const { email, password } = formData;
        toast.info(`Employee Login Credentials:\nEmail: ${email}\nPassword: ${password}`, {
          autoClose: 10000,
          position: "top-center"
        });
      }
      setShowModal(false);
      setEditingEmployee(null);
      resetForm();
      // Add a small delay to ensure backend has processed the request
      setTimeout(() => {
        fetchEmployees();
      }, 500);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      permissions: { ...employee.permissions },
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await axios.delete(`/employees/${id}`);
      toast.success('Employee deleted successfully');
      fetchEmployees();
    } catch (error) {
      toast.error('Failed to delete employee');
    }
  };

  const handleResetPassword = async (id) => {
    if (!window.confirm('Are you sure you want to reset this employee\'s password?')) return;
    try {
      await axios.post(`/employees/${id}/reset-password`);
      toast.success('Password reset successfully');
    } catch (error) {
      toast.error('Failed to reset password');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      permissions: {
        canManageUsers: false,
        canManageLoans: false,
        canManagePayments: false,
        canManageSupport: true,
        canSendNotifications: false,
        canViewAudit: false,
        canManageSettings: false,
      },
    });
  };

  const handlePermissionChange = (permission, value) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
        <button
          onClick={() => {
            setEditingEmployee(null);
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Employee
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Permissions
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
            {employees.map((employee) => (
              <tr key={employee._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                    <div className="text-sm text-gray-500">{employee.email}</div>
                    <div className="text-sm text-gray-500">{employee.phone}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {Object.entries(employee.permissions)
                      .filter(([_, value]) => value)
                      .map(([key, _]) => key.replace('can', '').replace('Manage', ' ').trim())
                      .join(', ') || 'No permissions'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    employee.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {employee.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleEdit(employee)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleResetPassword(employee._id)}
                    className="text-yellow-600 hover:text-yellow-900"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => handleDelete(employee._id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingEmployee ? 'Edit Employee' : 'Add Employee'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  {!editingEmployee && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      <input
                        type="password"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <h4 className="text-md font-medium text-gray-900 mb-2">Permissions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(formData.permissions).map(([permission, value]) => (
                      <label key={permission} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => handlePermissionChange(permission, e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">
                          {permission.replace('can', '').replace('Manage', ' ').trim()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingEmployee(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  >
                    {editingEmployee ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
