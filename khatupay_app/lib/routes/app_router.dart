import 'package:go_router/go_router.dart';
import 'package:khatupay_app/ui/screens/loan_dashboard_page.dart';
import '../ui/screens/auth/login_page.dart';
import '../ui/screens/auth/register_page.dart';
import '../ui/screens/auth/verify_email_page.dart';
import '../ui/screens/auth/forgot_password_page.dart';
import '../ui/screens/dashboard_page.dart';
import '../ui/screens/loan_apply_page.dart';
import '../ui/screens/loan_apply_wizard_page.dart';
import '../ui/screens/loan_apply_success_page.dart';
import '../ui/screens/loans_page.dart';
import '../ui/screens/loan_detail_page.dart';
import '../ui/screens/payments_page.dart';
import '../ui/screens/bills_page.dart';
import '../ui/screens/qr_page.dart';
import '../ui/screens/faq_page.dart';
import '../ui/screens/support_page.dart';
import '../ui/screens/profile_page.dart';
import '../ui/screens/settings_page.dart';
import '../ui/screens/pay_loan_page.dart';
import '../ui/screens/notifications_page.dart';
import '../ui/screens/withdraw_page.dart';
import '../core/fcm.dart'; // Import navigatorKey
import '../core/auth_storage.dart'; // Import AuthStorage

final router = GoRouter(
  initialLocation: '/login',
  navigatorKey: navigatorKey, // Add this line
  redirect: (context, state) async {
    final isLoggedIn = await AuthStorage.getAccessToken() != null;
    final isAuthRoute = state.matchedLocation == '/login' ||
                        state.matchedLocation == '/register' ||
                        state.matchedLocation == '/verify' ||
                        state.matchedLocation == '/forgot';

    if (!isLoggedIn && !isAuthRoute) {
      return '/login';
    }
    if (isLoggedIn && isAuthRoute) {
      return '/';
    }
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
    GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
    GoRoute(path: '/verify', builder: (_, __) => const VerifyEmailPage()),
    GoRoute(path: '/forgot', builder: (_, __) => const ForgotPasswordPage()),

    GoRoute(path: '/', builder: (_, __) => const DashboardPage()),
    GoRoute(path: '/apply', builder: (_, __) => const LoanApplyWizardPage()),
    GoRoute(path: '/apply-success/:id', builder: (ctx, s) => LoanApplySuccessPage(id: s.pathParameters['id']!)),
    GoRoute(path: '/loans', builder: (_, __) => const LoanDashboardPage()),
    GoRoute(path: '/loan/:id', builder: (ctx, s) => LoanDetailPage(id: s.pathParameters['id']!, loan: null)),
    GoRoute(path: '/pay-loan', builder: (_, __) => PayLoanPage()),
    GoRoute(path: '/payments', builder: (_, __) => const PaymentsPage()),
    GoRoute(path: '/bills', builder: (_, __) => const BillsPage()),
    GoRoute(path: '/qr', builder: (_, __) => const QRPage()),
    GoRoute(path: '/faq', builder: (_, __) => const FAQPage()),
    GoRoute(path: '/support', builder: (_, __) => const SupportPage()),
    GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
    GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
    GoRoute(path: '/notifications', builder: (_, __) => const NotificationsPage()),
    GoRoute(path: '/withdraw', builder: (_, __) => const WithdrawPage()),

  ],
);
