import 'package:go_router/go_router.dart';
import 'package:khatupay_app/ui/screens/loan_dashboard_page.dart';
import '../ui/screens/auth/login_page.dart';
import '../ui/screens/auth/register_page.dart';
import '../ui/screens/auth/verify_email_page.dart';
import '../ui/screens/auth/forgot_password_page.dart';
import '../ui/screens/dashboard_page.dart';
import '../ui/screens/loan_apply_page.dart';
import '../ui/screens/loans_page.dart';
import '../ui/screens/loan_detail_page.dart';
import '../ui/screens/payments_page.dart';
import '../ui/screens/bills_page.dart';
import '../ui/screens/qr_page.dart';
import '../ui/screens/faq_page.dart';
import '../ui/screens/support_page.dart';
import '../ui/screens/profile_page.dart';
import '../ui/screens/settings_page.dart';

final router = GoRouter(
  initialLocation: '/login',
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
    GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
    GoRoute(path: '/verify', builder: (_, __) => const VerifyEmailPage()),
    GoRoute(path: '/forgot', builder: (_, __) => const ForgotPasswordPage()),

    GoRoute(path: '/', builder: (_, __) => const DashboardPage()),
    GoRoute(path: '/apply', builder: (_, __) => const LoanApplyPage()),
    GoRoute(path: '/loans', builder: (_, __) => const LoansPage()),
    GoRoute(path: '/loan/:id', builder: (ctx, s) => LoanDetailPage(id: s.pathParameters['id']!)),
    GoRoute(path: '/payments', builder: (_, __) => const PaymentsPage()),
    GoRoute(path: '/bills', builder: (_, __) => const BillsPage()),
    GoRoute(path: '/qr', builder: (_, __) => const QRPage()),
    GoRoute(path: '/faq', builder: (_, __) => const FAQPage()),
    GoRoute(path: '/support', builder: (_, __) => const SupportPage()),
    GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
    GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
    GoRoute(path: '/loans', builder: (_, __) => const LoanDashboardPage()),

  ],
);
