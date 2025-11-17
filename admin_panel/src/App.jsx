import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Loans from './pages/Loans.jsx'
import Payments from './pages/Payments.jsx'
import FAQs from './pages/FAQs.jsx'
import Push from './pages/Push.jsx'
import NotificationHistory from './pages/NotificationHistory.jsx'
import Settings from './pages/Settings.jsx'
import Profile from './pages/Profile.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import Support from './pages/Support.jsx'
import Audit from './pages/Audit.jsx'
import NotFound from './pages/NotFound.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import Employees from './pages/Employees.jsx'
import EmployeeHistory from './pages/EmployeeHistory.jsx'
import EmployeeLogin from './pages/EmployeeLogin.jsx'
import EmployeeDashboard from './pages/EmployeeDashboard.jsx'
import EmployeeProtectedRoute from './components/EmployeeProtectedRoute.jsx'
import Withdrawals from './pages/Withdrawals.jsx'
import Reports from './pages/Reports.jsx'
import LoanSettlement from './pages/LoanSettlement.jsx'
import LegalAction from './pages/LegalAction.jsx'
import TrackLoan from './pages/TrackLoan.jsx'
import LoanCalculator from './components/LoanCalculator.jsx'
import EmiControl from './pages/EmiControl.jsx'
import AutoDebitStatus from './pages/AutoDebitStatus.jsx'
import ManualPaymentUpdate from './pages/ManualPaymentUpdate.jsx'
import PartPaymentSupport from './pages/PartPaymentSupport.jsx'
import PenaltyChargesManagement from './pages/PenaltyChargesManagement.jsx'
import ExtendEmiDueDate from './pages/ExtendEmiDueDate.jsx'
import OverdueUsersList from './pages/OverdueUsersList.jsx'
import CallLogs from './pages/CallLogs.jsx'
import AgentPerformanceReport from './pages/AgentPerformanceReport.jsx'
import PromiseToPayTracking from './pages/PromiseToPayTracking.jsx'
import VisitLogs from './pages/VisitLogs.jsx'
import WarningSmsTrigger from './pages/WarningSmsTrigger.jsx'
import CreateAgent from './pages/CreateAgent.jsx'

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/employee/login" element={<EmployeeLogin />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/faqs" element={<FAQs />} />
        <Route path="/push" element={<Push />} />
        <Route path="/notification-history" element={<NotificationHistory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/support" element={<Support />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/employee-history" element={<EmployeeHistory />} />
        <Route path="/withdrawals" element={<Withdrawals />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/loan-settlement" element={<LoanSettlement />} />
        <Route path="/legal-actions" element={<LegalAction />} />
        <Route path="/emi-control" element={<EmiControl />} />
        <Route path="/emi-control/auto-debit" element={<AutoDebitStatus />} />
        <Route path="/emi-control/manual-payment" element={<ManualPaymentUpdate />} />
        <Route path="/emi-control/part-payment" element={<PartPaymentSupport />} />
        <Route path="/emi-control/penalty-management" element={<PenaltyChargesManagement />} />
        <Route path="/emi-control/extend-due-date" element={<ExtendEmiDueDate />} />
        <Route path="/track-loan" element={<TrackLoan />} />
        <Route path="/loan-calculator" element={<LoanCalculator />} />
        <Route path="/overdue-users" element={<OverdueUsersList />} />
        <Route path="/call-logs" element={<CallLogs />} />
        <Route path="/agent-performance" element={<AgentPerformanceReport />} />
        <Route path="/ptp-tracking" element={<PromiseToPayTracking />} />
        <Route path="/visit-logs" element={<VisitLogs />} />
        <Route path="/warning-sms" element={<WarningSmsTrigger />} />
        <Route path="/create-agent" element={<CreateAgent />} />
        <Route path="/audit" element={<Audit />} />
      </Route>
      <Route element={<EmployeeProtectedRoute />}>
        <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
