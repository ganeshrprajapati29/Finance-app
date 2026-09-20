import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/app_theme.dart';
import '../../routes/app_router.dart';
import '../widgets/app_back_button.dart';

class LoanApplySuccessPage extends StatelessWidget {
  final String id;

  const LoanApplySuccessPage({super.key, required this.id});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Application Submitted'),
        leading: const AppBackButton(fallbackRoute: '/loans'),
      ),
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(18.w),
          child: Column(
            children: [
              Expanded(
                child: Center(
                  child: Container(
                    width: double.infinity,
                    padding: EdgeInsets.all(22.w),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24.r),
                      border: Border.all(color: KhatuColors.line),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.08),
                          blurRadius: 28,
                          offset: const Offset(0, 16),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ClipRect(
                          child: Align(
                            alignment: Alignment.topLeft,
                            widthFactor: 0.5,
                            heightFactor: 0.5,
                            child: Image.asset(
                              'assets/loans/loan_lifecycle.png',
                              width: 220.w,
                              height: 220.w,
                              fit: BoxFit.cover,
                              alignment: Alignment.topLeft,
                              semanticLabel: 'Loan application submitted securely',
                            ),
                          ),
                        ),
                        SizedBox(height: 22.h),
                        Text(
                          'Loan application received',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: KhatuColors.text,
                            fontSize: 24.sp,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 8.h),
                        Text(
                          'Your request is under review. You will get updates in the app after verification.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: KhatuColors.muted,
                            fontSize: 14.sp,
                            height: 1.45,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        SizedBox(height: 22.h),
                        Container(
                          width: double.infinity,
                          padding: EdgeInsets.all(16.w),
                          decoration: BoxDecoration(
                            color: KhatuColors.bg,
                            borderRadius: BorderRadius.circular(16.r),
                            border: Border.all(color: KhatuColors.line),
                          ),
                          child: Column(
                            children: [
                              const Text(
                                'Loan Application ID',
                                style: TextStyle(color: KhatuColors.muted, fontWeight: FontWeight.w800),
                              ),
                              SizedBox(height: 6.h),
                              Row(
                                children: [
                                  Expanded(
                                    child: SelectableText(
                                      id,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        color: KhatuColors.teal,
                                        fontSize: 16.sp,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: 'Copy loan ID',
                                    onPressed: () async {
                                      await Clipboard.setData(ClipboardData(text: id));
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(content: Text('Loan ID copied')),
                                        );
                                      }
                                    },
                                    icon: const Icon(Icons.copy_rounded, color: KhatuColors.teal),
                                  ),
                                ],
                              ),
                              SizedBox(height: 12.h),
                              _TimelineStep(
                                icon: Icons.assignment_turned_in_outlined,
                                title: 'Application saved',
                                subtitle: 'Your loan request is now visible to the KhatuPay review team.',
                              ),
                              SizedBox(height: 10.h),
                              _TimelineStep(
                                icon: Icons.verified_user_outlined,
                                title: 'Verification review',
                                subtitle: 'PAN, Aadhaar and profile details will be checked before approval.',
                              ),
                              SizedBox(height: 10.h),
                              _TimelineStep(
                                icon: Icons.notifications_active_outlined,
                                title: 'Status updates',
                                subtitle: 'You will get every approval or action update in the app.',
                                isLast: true,
                              ),
                            ],
                          ),
                        ),
                        SizedBox(height: 16.h),
                        _InfoStrip(
                          icon: Icons.phone_in_talk_outlined,
                          text: 'Keep your registered mobile reachable for verification updates.',
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              ElevatedButton.icon(
                onPressed: () => router.go('/loans'),
                icon: const Icon(Icons.account_balance),
                label: const Text('Track Application'),
                style: ElevatedButton.styleFrom(minimumSize: Size(double.infinity, 52.h)),
              ),
              SizedBox(height: 10.h),
              TextButton(
                onPressed: () => router.go('/'),
                child: const Text('Back to Home'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TimelineStep extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool isLast;

  const _TimelineStep({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 30.w,
              height: 30.w,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFFE0F2FE),
              ),
              child: Icon(icon, color: KhatuColors.teal, size: 18.sp),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 24.h,
                color: KhatuColors.line,
              ),
          ],
        ),
        SizedBox(width: 10.w),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(top: 3.h),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: KhatuColors.text,
                    fontSize: 13.sp,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 2.h),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: KhatuColors.muted,
                    fontSize: 11.5.sp,
                    height: 1.35,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoStrip extends StatelessWidget {
  final IconData icon;
  final String text;

  const _InfoStrip({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(12.w),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        children: [
          Icon(icon, color: KhatuColors.saffron),
          SizedBox(width: 10.w),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(color: Color(0xFF92400E), fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
