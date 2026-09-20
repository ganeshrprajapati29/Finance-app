import 'package:go_router/go_router.dart';
import 'package:khatupay_app/ui/screens/loan_dashboard_page.dart';
import '../ui/screens/auth/login_page.dart';
import '../ui/screens/auth/register_page.dart';
import '../ui/screens/auth/verify_email_page.dart';
import '../ui/screens/auth/forgot_password_page.dart';
import '../ui/screens/splash_screen.dart';
import '../ui/screens/dashboard_page.dart';
import '../ui/screens/coming_soon_page.dart';
import '../ui/screens/loan_apply_wizard_page.dart';
import '../ui/screens/loan_apply_success_page.dart';
import '../ui/screens/loan_detail_page.dart';
import '../ui/screens/payments_page.dart';
import '../ui/screens/bills_page.dart';
import '../ui/screens/qr_page.dart';
import '../ui/screens/qr_sticker_order_page.dart';
import '../ui/screens/faq_page.dart';
import '../ui/screens/support_page.dart';
import '../ui/screens/profile_page.dart';
import '../ui/screens/kyc_page.dart';
import '../ui/screens/settings_page.dart';
import '../ui/screens/change_password_page.dart';
import '../ui/screens/notifications_page.dart';
import '../ui/screens/withdraw_page.dart';
import '../ui/screens/payment_history_page.dart';
import '../ui/screens/offers_page.dart';
import '../ui/screens/rewards_page.dart';
import '../ui/screens/virtual_card_page.dart';
import '../clubapi/ui/clubapi_bill_page.dart';
import '../clubapi/ui/clubapi_recharge_page.dart';
import '../clubapi/ui/clubapi_recharge_result_page.dart';
import '../clubapi/ui/service_status_page.dart';
import '../clubapi/ui/service_ui.dart' show ServiceStatusArgs;
import '../core/fcm.dart';
import '../ui/screens/business/business_home_page.dart';
import '../ui/screens/business/business_registration_page.dart';
import '../ui/screens/business/business_verification_page.dart';
import '../ui/screens/business/merchant_qr_page.dart';
import '../ui/screens/business/merchant_settlements_page.dart';

final router = GoRouter(
  initialLocation: '/splash',
  navigatorKey: navigatorKey,
  routes: [
    // Authentication routes
    GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
    GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
    GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
    GoRoute(
      path: '/verify',
      builder: (_, state) =>
          VerifyEmailPage(email: state.uri.queryParameters['email']),
    ),
    GoRoute(path: '/forgot', builder: (_, __) => const ForgotPasswordPage()),
    // Main app routes
    GoRoute(path: '/', builder: (_, __) => const DashboardPage()),
    GoRoute(path: '/apply', builder: (_, __) => const LoanApplyWizardPage()),
    // '/loan-apply' (old LoanApplyPage, no KYC/eligibility checks) and
    // '/pay-loan' (pays off any stranger's loan by ID + mobile, no consent
    // check) are intentionally not routed - real loan applications go
    // through '/apply' (LoanApplyWizardPage) only. Files are kept, just
    // not reachable.
    GoRoute(
        path: '/apply-success/:id',
        builder: (ctx, s) => LoanApplySuccessPage(id: s.pathParameters['id']!)),
    GoRoute(path: '/loans', builder: (_, __) => const LoanDashboardPage()),
    GoRoute(
        path: '/loan/:id',
        builder: (ctx, s) =>
            LoanDetailPage(id: s.pathParameters['id']!, loan: null)),
    GoRoute(path: '/payments', builder: (_, __) => const PaymentsPage()),
    GoRoute(path: '/business', builder: (_, __) => const BusinessHomePage()),
    GoRoute(
        path: '/business/register',
        builder: (_, __) => const BusinessRegistrationPage()),
    GoRoute(
        path: '/business/verification',
        builder: (_, __) => const BusinessVerificationPage()),
    GoRoute(path: '/business/qr', builder: (_, __) => const MerchantQrPage()),
    GoRoute(
        path: '/business/transactions',
        builder: (_, __) => const PaymentHistoryPage()),
    GoRoute(
        path: '/business/settlements',
        builder: (_, __) => const MerchantSettlementsPage()),
    GoRoute(
        path: '/khatu-upi',
        builder: (_, __) => const ComingSoonPage(title: 'UPI')),
    GoRoute(
        path: '/payment-chats',
        builder: (_, __) => const ComingSoonPage(title: 'Pay Chat')),
    GoRoute(
        path: '/payment-chat/:id',
        builder: (_, __) => const ComingSoonPage(title: 'Pay Chat')),
    GoRoute(
        path: '/payment-chat-history',
        builder: (_, __) => const PaymentHistoryPage()),
    GoRoute(
        path: '/virtual-card', builder: (_, __) => const VirtualCardsPage()),
    GoRoute(
        path: '/virtual-card/apply',
        builder: (_, __) => const VirtualCardApplyPage()),
    GoRoute(path: '/bills', builder: (_, __) => const BillsPage()),
    GoRoute(path: '/qr', builder: (_, __) => const QRPage()),
    GoRoute(
        path: '/qr-scan',
        builder: (_, __) => const ComingSoonPage(title: 'Scan & Pay')),
    GoRoute(
        path: '/qr-sticker-order',
        builder: (_, state) =>
            QRStickerOrderPage(qrId: state.uri.queryParameters['qrId'])),
    GoRoute(
        path: '/qr-sticker-orders',
        builder: (_, __) => const QRStickerOrdersPage()),
    GoRoute(
        path: '/qr-sticker-orders/:id',
        builder: (_, state) =>
            QRStickerOrderDetailPage(id: state.pathParameters['id']!)),
    GoRoute(path: '/faq', builder: (_, __) => const FAQPage()),
    GoRoute(
      path: '/support',
      builder: (_, state) => SupportPage(
        initialSubject: state.uri.queryParameters['subject'],
        initialMessage: state.uri.queryParameters['message'],
      ),
    ),
    GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
    GoRoute(path: '/kyc', builder: (_, __) => const KycPage()),
    GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
    GoRoute(
        path: '/change-password',
        builder: (_, __) => const ChangePasswordPage()),
    GoRoute(
        path: '/notifications', builder: (_, __) => const NotificationsPage()),
    GoRoute(path: '/withdraw', builder: (_, __) => const WithdrawPage()),
    GoRoute(path: '/offers', builder: (_, __) => const OffersPage()),
    GoRoute(
        path: '/offers/:id',
        builder: (_, state) =>
            OfferDetailPage(id: state.pathParameters['id']!)),
    GoRoute(path: '/rewards', builder: (_, __) => const RewardsPage()),

    // Service routes
    // '/services' and '/clubapi/dashboard' were a merchant/agent-onboarding
    // hub (bank-validate/outlet-registration/payout tools) duplicating what
    // Bills & Recharge already cover for retail users - gated, not deleted,
    // same pattern as the other coming-soon screens in this file.
    GoRoute(
        path: '/services',
        builder: (_, __) => const ComingSoonPage(title: 'Services')),
    GoRoute(
        path: '/bill',
        builder: (_, state) =>
            ClubAPIBillPage(initialType: state.uri.queryParameters['type'])),
    GoRoute(
        path: '/recharge',
        builder: (_, state) => ClubAPIRechargePage(
            initialType: state.uri.queryParameters['type'])),
    // Live status of a recharge / bill payment (polls until confirmed).
    GoRoute(
        path: '/service-status',
        builder: (_, state) {
          final extra = state.extra;
          final args = extra is ServiceStatusArgs ? extra : null;
          final query = state.uri.queryParameters;
          return ServiceStatusPage(
            serviceKey: query['service'] ?? args?.serviceKey ?? 'mobile',
            urid: query['urid'],
            orderId: query['order'],
            args: args,
          );
        }),
    GoRoute(
        path: '/recharge-result',
        builder: (_, state) =>
            RechargeResultPage(data: state.extra as RechargeResultData)),
    GoRoute(
        path: '/service-history',
        builder: (_, __) => const PaymentHistoryPage()),
    GoRoute(
        path: '/clubapi/dashboard',
        builder: (_, __) => const ComingSoonPage(title: 'Services')),
    GoRoute(
        path: '/clubapi/bill',
        builder: (_, state) =>
            ClubAPIBillPage(initialType: state.uri.queryParameters['type'])),
    GoRoute(
        path: '/clubapi/bank-validate',
        builder: (_, __) => const ComingSoonPage(title: 'Bank Validate')),
    GoRoute(
        path: '/clubapi/outlet',
        builder: (_, __) => const ComingSoonPage(title: 'Outlet Setup')),
    GoRoute(
        path: '/clubapi/payout',
        builder: (_, __) => const ComingSoonPage(title: 'Payout')),
    GoRoute(
        path: '/payment-history',
        builder: (_, __) => const PaymentHistoryPage())
  ],
);
