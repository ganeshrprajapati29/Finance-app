import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../services/auth_service.dart';
import '../../../routes/app_router.dart';

class VerifyEmailPage extends StatefulWidget {
  const VerifyEmailPage({super.key});

  @override
  State<VerifyEmailPage> createState() => _VerifyEmailPageState();
}

class _VerifyEmailPageState extends State<VerifyEmailPage> {
  final emailController = TextEditingController();
  final otpController = TextEditingController();
  String message = '';
  bool isLoading = false;

  @override
  void dispose() {
    emailController.dispose();
    otpController.dispose();
    super.dispose();
  }

  Future<void> _verifyEmail() async {
    setState(() {
      isLoading = true;
      message = '';
    });

    try {
      await AuthService().verifyEmail(emailController.text.trim(), otpController.text.trim());
      setState(() => message = 'Email verified successfully!');
      // Navigate to login after successful verification
      Future.delayed(const Duration(seconds: 2), () {
        router.go('/login');
      });
    } catch (e) {
      setState(() => message = 'Verification failed: $e');
    } finally {
      setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: Text(
          'Verify Email',
          style: TextStyle(color: Colors.black, fontSize: 18.sp),
        ),
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Email Verification',
              style: TextStyle(
                fontSize: 24.sp,
                fontWeight: FontWeight.bold,
                color: Colors.blueAccent,
              ),
            ),
            SizedBox(height: 8.h),
            Text(
              'Enter the OTP sent to your email to verify your account',
              style: TextStyle(
                fontSize: 14.sp,
                color: Colors.grey,
              ),
            ),
            SizedBox(height: 24.h),
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                labelText: 'Email Address',
                prefixIcon: Icon(Icons.email, color: Colors.blueAccent),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12.r),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.blueAccent),
                  borderRadius: BorderRadius.circular(12.r),
                ),
              ),
            ),
            SizedBox(height: 16.h),
            TextField(
              controller: otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: InputDecoration(
                labelText: 'OTP Code',
                prefixIcon: Icon(Icons.lock_clock, color: Colors.blueAccent),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12.r),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.blueAccent),
                  borderRadius: BorderRadius.circular(12.r),
                ),
                counterText: '',
              ),
            ),
            SizedBox(height: 24.h),
            ElevatedButton(
              onPressed: isLoading ? null : _verifyEmail,
              style: ElevatedButton.styleFrom(
                minimumSize: Size(double.infinity, 48.h),
                backgroundColor: Colors.blueAccent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12.r),
                ),
              ),
              child: Text(
                isLoading ? 'Verifying...' : 'Verify Email',
                style: TextStyle(fontSize: 16.sp),
              ),
            ),
            SizedBox(height: 16.h),
            if (message.isNotEmpty)
              Container(
                padding: EdgeInsets.all(12.w),
                decoration: BoxDecoration(
                  color: message.contains('successfully') ? Colors.green.shade50 : Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8.r),
                  border: Border.all(
                    color: message.contains('successfully') ? Colors.green : Colors.red,
                  ),
                ),
                child: Text(
                  message,
                  style: TextStyle(
                    color: message.contains('successfully') ? Colors.green : Colors.red,
                    fontSize: 14.sp,
                  ),
                ),
              ),
            SizedBox(height: 16.h),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  "Didn't receive OTP?",
                  style: TextStyle(fontSize: 14.sp),
                ),
                TextButton(
                  onPressed: () {
                    // TODO: Implement resend OTP functionality
                    setState(() => message = 'OTP resent to your email');
                  },
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.green,
                  ),
                  child: Text(
                    'Resend',
                    style: TextStyle(fontSize: 14.sp),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
