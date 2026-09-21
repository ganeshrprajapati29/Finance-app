import { Routes, Route, Navigate, BrowserRouter, useLocation } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop.jsx'

import Home from './pages/Home.jsx'

import DynamicPage from './pages/DynamicPage.jsx'
import About from './pages/About.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import TermsConditions from './pages/TermsConditions.jsx'
import RefundPolicy from './pages/RefundPolicy.jsx'
import CookiePolicy from './pages/CookiePolicy.jsx'
import Disclaimer from './pages/Disclaimer.jsx'
import InstantLoans from './pages/InstantLoans.jsx'
import DigitalPayments from './pages/DigitalPayments.jsx'
import QrPayments from './pages/QrPayments.jsx'
import Investment from './pages/Investment.jsx'
import FamilyAccounts from './pages/FamilyAccounts.jsx'
import Careers from './pages/Careers.jsx'
import Blog from './pages/Blog.jsx'
import Press from './pages/Press.jsx'
import Contact from './pages/Contact.jsx'
import HelpCenter from './pages/HelpCenter.jsx'
import Security from './pages/Security.jsx'
import Features from './pages/Features.jsx'
import Pricing from './pages/Pricing.jsx'
import UserAuth from './pages/UserAuth.jsx'
import UserPortal from './pages/UserPortal.jsx'
import PaymentReturn from './pages/PaymentReturn.jsx'
import MerchantPay from './pages/MerchantPay.jsx'

// Auth Pages
import Login from './pages/Login.jsx'
import EmployeeLogin from './pages/EmployeeLogin.jsx'

// Admin Pages
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import UserDetail from './pages/UserDetail.jsx'
import KycReview from './pages/KycReview.jsx'
import Loans from './pages/Loans.jsx'
import Payments from './pages/Payments.jsx'
import Offers from './pages/Offers.jsx'
import Rewards from './pages/Rewards.jsx'
import FAQs from './pages/FAQs.jsx'
import Push from './pages/Push.jsx'
import NotificationHistory from './pages/NotificationHistory.jsx'
import Settings from './pages/Settings.jsx'
import Profile from './pages/Profile.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import Support from './pages/Support.jsx'
import Audit from './pages/Audit.jsx'
import Employees from './pages/Employees.jsx'
import EmployeeHistory from './pages/EmployeeHistory.jsx'
import Withdrawals from './pages/Withdrawals.jsx'
import Reports from './pages/Reports.jsx'
import LoanSettlement from './pages/LoanSettlement.jsx'
import LegalAction from './pages/LegalAction.jsx'
import TrackLoan from './pages/TrackLoan.jsx'
import LoanCalculator from './pages/LoanCalculator.jsx'
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
import VirtualAccounts from './pages/VirtualAccounts.jsx'
import VirtualCards from './pages/VirtualCards.jsx'
import Payouts from './pages/Payouts.jsx'
import QR from './pages/QR.jsx'
import QRStickerOrders from './pages/QRStickerOrders.jsx'
import Invoices from './pages/Invoices.jsx'
import EarningsDashboard from './pages/EarningsDashboard.jsx'
import LoanEarnings from './pages/LoanEarnings.jsx'
import QREarnings from './pages/QREarnings.jsx'
import AdsEarnings from './pages/AdsEarnings.jsx'
import BillEarnings from './pages/BillEarnings.jsx'
import BusinessQR from './pages/BusinessQR.jsx'

// Club API Pages
import ClubAPIDashboard from './pages/ClubAPIDashboard.jsx'
import ClubAPITransactionsNew from './pages/ClubAPITransactionsNew.jsx'
import ClubAPIBills from './pages/ClubAPIBills.jsx'
import ClubAPISettings from './pages/ClubAPISettings.jsx'
import ClubAPITools from './pages/ClubAPITools.jsx'
import ClubAPIFundRequests from './pages/ClubAPIFundRequests.jsx'
import ServiceCatalog from './pages/ServiceCatalog.jsx'

// Employee
import EmployeeDashboard from './pages/EmployeeDashboard.jsx'

// Components
import ProtectedRoute from './components/ProtectedRoute.jsx'
import EmployeeProtectedRoute from './components/EmployeeProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import EmployeeLayout from './components/EmployeeLayout.jsx'
import PublicLayout from './components/PublicLayout.jsx'

// 404
import NotFound from './pages/NotFound.jsx'

export function AppContent() {
  return (
    <Routes>
      {/* Public Routes with Layout */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/instant-loans" element={<InstantLoans />} />
        <Route path="/digital-payments" element={<DigitalPayments />} />
        <Route path="/qr-payments" element={<QrPayments />} />
        <Route path="/investment" element={<Investment />} />
        <Route path="/family-accounts" element={<FamilyAccounts />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/press" element={<Press />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/help-center" element={<HelpCenter />} />
        <Route path="/security" element={<Security />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/services/:slug" element={<DynamicPage />} />
        <Route path="/user/login" element={<UserAuth />} />
        <Route path="/user/register" element={<UserAuth mode="register" />} />
        <Route path="/user/portal" element={<UserPortal />} />
        <Route path="/payment-success" element={<PaymentReturn />} />
        <Route path="/payment-failed" element={<PaymentReturn />} />
        <Route path="/payment-pending" element={<PaymentReturn />} />
        <Route path="/payment-timeout" element={<PaymentReturn />} />
        <Route path="/refund-success" element={<PaymentReturn />} />
        <Route path="/payment-history" element={<Navigate to="/user/portal" replace />} />
        <Route path="/pay/merchant/:merchantId" element={<MerchantPay />} />
      </Route>

      {/* Login Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/employee/login" element={<EmployeeLogin />} />


      {/* Protected Admin Dashboard Routes */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/kyc" element={<KycReview />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/rewards" element={<Rewards />} />
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

        {/* EMI Control */}
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
        <Route path="/virtual-accounts" element={<VirtualAccounts />} />
        <Route path="/virtual-cards" element={<VirtualCards />} />
        <Route path="/payouts" element={<Payouts />} />
        <Route path="/qr" element={<QR />} />
        <Route path="/business-qr" element={<BusinessQR />} />
        <Route path="/qr-sticker-orders" element={<QRStickerOrders />} />
        <Route path="/invoices" element={<Invoices />} />

        {/* Earnings */}
        <Route path="/earnings-dashboard" element={<EarningsDashboard />} />
        <Route path="/bill-earnings" element={<BillEarnings />} />
        <Route path="/loan-earnings" element={<LoanEarnings />} />
        <Route path="/qr-earnings" element={<QREarnings />} />
        <Route path="/ads-earnings" element={<AdsEarnings />} />

        {/* Club API */}
        <Route path="/clubapi/dashboard" element={<ClubAPIDashboard />} />
        <Route path="/clubapi/transactions" element={<ClubAPITransactionsNew />} />
        <Route path="/clubapi/fund-requests" element={<ClubAPIFundRequests />} />
        <Route path="/clubapi/bills" element={<ClubAPIBills />} />
        <Route path="/clubapi/tools" element={<ClubAPITools />} />
        <Route path="/clubapi/settings" element={<ClubAPISettings />} />
        <Route path="/clubapi/services" element={<ServiceCatalog />} />

        <Route path="/audit" element={<Audit />} />
      </Route>


      {/* Employee Protected Routes */}
      <Route element={<EmployeeProtectedRoute />}>
        <Route element={<EmployeeLayout />}>
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="/employee/users" element={<EmployeeDashboard module="users" />} />
          <Route path="/employee/loans" element={<EmployeeDashboard module="loans" />} />
          <Route path="/employee/payments" element={<EmployeeDashboard module="payments" />} />
          <Route path="/employee/support" element={<EmployeeDashboard module="support" />} />
          <Route path="/employee/push" element={<EmployeeDashboard module="push" />} />
          <Route path="/employee/collections" element={<EmployeeDashboard module="collections" />} />
          <Route path="/employee/reports" element={<EmployeeDashboard module="reports" />} />
          <Route path="/employee/history" element={<EmployeeDashboard module="history" />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <ScrollToTop />
    </BrowserRouter>
  )
}
