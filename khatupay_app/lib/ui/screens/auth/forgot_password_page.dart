import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../services/auth_service.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final emailController = TextEditingController();
  final otpController = TextEditingController();
  final passwordController = TextEditingController();
  String message = '';
  bool isLoading = false;
  bool otpSent = false;

  @override
  void dispose() {
    emailController.dispose();
    otpController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> _sendOTP() async {
    if (emailController.text.isEmpty) {
      setState(() => message = 'Please enter your email');
      return;
    }

    setState(() {
      isLoading = true;
      message = '';
    });

    try {
      await AuthService().forgot(emailController.text.trim());
      setState(() {
        otpSent = true;
        message = 'OTP sent to your email';
      });
    } catch (e) {
      setState(() => message = 'Failed to send OTP: $e');
    } finally {
      setState(() => isLoading = false);
    }
  }

  Future<void> _resetPassword() async {
    if (emailController.text.isEmpty || otpController.text.isEmpty || passwordController.text.isEmpty) {
      setState(() => message = 'Please fill all fields');
      return;
    }

    setState(() {
      isLoading = true;
      message = '';
    });

    try {
      await AuthService().reset(
        emailController.text.trim(),
        otpController.text.trim(),
        passwordController.text.trim(),
      );
      setState(() => message = 'Password updated successfully!');
      // Navigate back to login after successful reset
      Future.delayed(const Duration(seconds: 2), () {
        Navigator.of(context).pop();
      });
    } catch (e) {
      setState(() => message = 'Failed to reset password: $e');
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
          'Reset Password',
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
              'Forgot Password',
              style: TextStyle(
                fontSize: 24.sp,
                fontWeight: FontWeight.bold,
                color: Colors.blueAccent,
              ),
            ),
            SizedBox(height: 8.h),
            Text(
              'Enter your email to receive an OTP and reset your password',
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
            if (otpSent) ...[
              Row(
                children: [
                  Expanded(
                    child: TextField(
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
                  ),
                  SizedBox(width: 12.w),
                  TextButton(
                    onPressed: isLoading ? null : _sendOTP,
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.green,
                      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                    ),
                    child: Text(
                      'Resend',
                      style: TextStyle(fontSize: 14.sp),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 16.h),
              TextField(
                controller: passwordController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'New Password',
                  prefixIcon: Icon(Icons.lock, color: Colors.blueAccent),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12.r),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: Colors.blueAccent),
                    borderRadius: BorderRadius.circular(12.r),
                  ),
                ),
              ),
              SizedBox(height: 24.h),
              ElevatedButton(
                onPressed: isLoading ? null : _resetPassword,
                style: ElevatedButton.styleFrom(
                  minimumSize: Size(double.infinity, 48.h),
                  backgroundColor: Colors.blueAccent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12.r),
                  ),
                ),
                child: Text(
                  isLoading ? 'Resetting...' : 'Reset Password',
                  style: TextStyle(fontSize: 16.sp),
                ),
              ),
            ] else ...[
              SizedBox(height: 24.h),
              ElevatedButton(
                onPressed: isLoading ? null : _sendOTP,
                style: ElevatedButton.styleFrom(
                  minimumSize: Size(double.infinity, 48.h),
                  backgroundColor: Colors.blueAccent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12.r),
                  ),
                ),
                child: Text(
                  isLoading ? 'Sending...' : 'Send OTP',
                  style: TextStyle(fontSize: 16.sp),
                ),
              ),
            ],
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
          ],
        ),
      ),
    );
  }
}
