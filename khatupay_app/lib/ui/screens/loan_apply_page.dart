import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../services/loan_service.dart';
import '../../routes/app_router.dart';

class LoanApplyPage extends StatefulWidget {
  const LoanApplyPage({super.key});

  @override
  State<LoanApplyPage> createState() => _LoanApplyPageState();
}

class _LoanApplyPageState extends State<LoanApplyPage> {
  final amountController = TextEditingController();
  final tenureController = TextEditingController(text: '12');
  final purposeController = TextEditingController(text: 'Personal');
  String message = '';
  bool isLoading = false;

  @override
  void dispose() {
    amountController.dispose();
    tenureController.dispose();
    purposeController.dispose();
    super.dispose();
  }

  Future<void> _applyLoan() async {
    if (amountController.text.isEmpty || tenureController.text.isEmpty || purposeController.text.isEmpty) {
      setState(() => message = 'Please fill all fields');
      return;
    }

    final amount = num.tryParse(amountController.text);
    final tenure = int.tryParse(tenureController.text);

    if (amount == null || amount <= 0) {
      setState(() => message = 'Please enter a valid amount');
      return;
    }

    if (tenure == null || tenure <= 0) {
      setState(() => message = 'Please enter a valid tenure');
      return;
    }

    setState(() {
      isLoading = true;
      message = '';
    });

    try {
      final id = await LoanService().apply(amount, tenure, purpose: purposeController.text.trim());
      setState(() => message = 'Loan application submitted successfully! Loan ID: $id');
      // Navigate to loans page after successful application
      Future.delayed(const Duration(seconds: 2), () {
        router.go('/loans');
      });
    } catch (e) {
      setState(() => message = 'Failed to apply for loan: $e');
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
          'Apply for Loan',
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
              'Loan Application',
              style: TextStyle(
                fontSize: 24.sp,
                fontWeight: FontWeight.bold,
                color: Colors.blueAccent,
              ),
            ),
            SizedBox(height: 8.h),
            Text(
              'Apply for a loan with flexible terms and quick approval',
              style: TextStyle(
                fontSize: 14.sp,
                color: Colors.grey,
              ),
            ),
            SizedBox(height: 24.h),
            TextField(
              controller: amountController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'Loan Amount (₹)',
                prefixIcon: Icon(Icons.currency_rupee, color: Colors.blueAccent),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12.r),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.blueAccent),
                  borderRadius: BorderRadius.circular(12.r),
                ),
                hintText: 'Enter amount (e.g., 50000)',
              ),
            ),
            SizedBox(height: 16.h),
            TextField(
              controller: tenureController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'Tenure (Months)',
                prefixIcon: Icon(Icons.calendar_today, color: Colors.blueAccent),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12.r),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.blueAccent),
                  borderRadius: BorderRadius.circular(12.r),
                ),
                hintText: 'Enter tenure in months',
              ),
            ),
            SizedBox(height: 16.h),
            TextField(
              controller: purposeController,
              decoration: InputDecoration(
                labelText: 'Purpose',
                prefixIcon: Icon(Icons.description, color: Colors.blueAccent),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12.r),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.blueAccent),
                  borderRadius: BorderRadius.circular(12.r),
                ),
                hintText: 'e.g., Personal, Business, Education',
              ),
            ),
            SizedBox(height: 24.h),
            ElevatedButton(
              onPressed: isLoading ? null : _applyLoan,
              style: ElevatedButton.styleFrom(
                minimumSize: Size(double.infinity, 48.h),
                backgroundColor: Colors.blueAccent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12.r),
                ),
              ),
              child: Text(
                isLoading ? 'Submitting...' : 'Apply for Loan',
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
            Card(
              color: Colors.blue.shade50,
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Padding(
                padding: EdgeInsets.all(16.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Loan Terms & Conditions',
                      style: TextStyle(
                        fontSize: 16.sp,
                        fontWeight: FontWeight.bold,
                        color: Colors.blueAccent,
                      ),
                    ),
                    SizedBox(height: 8.h),
                    Text(
                      '• Interest rates starting from 12% per annum\n• Processing fee: 2% of loan amount\n• Minimum tenure: 3 months\n• Maximum tenure: 60 months\n• Quick approval within 24 hours',
                      style: TextStyle(
                        fontSize: 12.sp,
                        color: Colors.black87,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
