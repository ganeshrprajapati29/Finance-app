import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../services/payment_service.dart';
import '../../services/user_service.dart';
import '../../routes/app_router.dart';

class PayLoanPage extends ConsumerStatefulWidget {
  const PayLoanPage({super.key});

  @override
  ConsumerState<PayLoanPage> createState() => _PayLoanPageState();
}

class _PayLoanPageState extends ConsumerState<PayLoanPage> {
  final mobileController = TextEditingController();
  List<Map<String, dynamic>> foundLoans = [];
  bool searchingLoan = false;
  String msg = '';

  Future<void> _searchLoan() async {
    if (mobileController.text.isEmpty) {
      setState(() => msg = 'Please enter mobile number');
      return;
    }

    setState(() {
      searchingLoan = true;
      msg = '';
      foundLoans = [];
    });

    try {
      final userService = UserService();
      final loans = await userService.searchLoansByMobile(mobileController.text);
      setState(() => foundLoans = loans);
      if (loans.isEmpty) {
        setState(() => msg = 'No loans found for this mobile number');
      }
    } catch (e) {
      print('Search error: $e');
      setState(() => msg = 'No loans found for this mobile number');
    } finally {
      setState(() => searchingLoan = false);
    }
  }

  Future<void> _payFullLoan(Map<String, dynamic> loan) async {
    setState(() => msg = 'Processing full loan payment...');

    try {
      final ps = PaymentService();
      final data = await ps.createRazorpayOrder(
        loan['outstandingAmount'],
        loanId: loan['_id'],
        isFullPayment: true,
      );
      final order = data['order'];

      ps.newCheckout(
        amount: loan['outstandingAmount'],
        orderId: order['id'],
        onSuccess: (oid, pid, sig) async {
          await ps.verifyRazorpay(oid, pid, sig);
          if (mounted) {
            setState(() {
              msg = 'Full loan payment successful!';
              foundLoans = [];
              mobileController.clear();
            });
          }
        },
        onFail: (m) {
          if (mounted) setState(() => msg = 'Payment failed: $m');
        },
      );
    } catch (e) {
      if (mounted) setState(() => msg = 'Error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: Text(
          'Pay Full Loan',
          style: TextStyle(color: Colors.black, fontSize: 18.sp),
        ),
        iconTheme: const IconThemeData(color: Colors.black),
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: Colors.blueAccent, size: 24.sp),
          onPressed: () => router.go('/'),
        ),
      ),
      body: Padding(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Pay Full Loan for Others',
              style: TextStyle(
                fontSize: 24.sp,
                fontWeight: FontWeight.bold,
                color: Colors.blueAccent,
              ),
            ),
            SizedBox(height: 16.h),
            Text(
              'Enter the loan details to search and pay the full outstanding amount.',
              style: TextStyle(
                fontSize: 16.sp,
                color: Colors.grey,
              ),
            ),
            SizedBox(height: 32.h),
            TextField(
              controller: mobileController,
              decoration: InputDecoration(
                labelText: 'Mobile Number',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8.r),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.blueAccent),
                  borderRadius: BorderRadius.circular(8.r),
                ),
                contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
              ),
              keyboardType: TextInputType.phone,
              style: TextStyle(fontSize: 16.sp),
            ),
            SizedBox(height: 16.h),
            if (searchingLoan)
              Center(
                child: CircularProgressIndicator(
                  color: Colors.blueAccent,
                ),
              )
            else
              ElevatedButton(
                onPressed: _searchLoan,
                child: Text(
                  'Search Loans',
                  style: TextStyle(fontSize: 16.sp),
                ),
                style: ElevatedButton.styleFrom(
                  minimumSize: Size(double.infinity, 48.h),
                  backgroundColor: Colors.blueAccent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8.r),
                  ),
                ),
              ),
            if (foundLoans.isNotEmpty)
              Expanded(
                child: ListView.builder(
                  itemCount: foundLoans.length,
                  itemBuilder: (context, index) {
                    final loan = foundLoans[index];
                    return Card(
                      margin: EdgeInsets.only(top: 16.h),
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
                              'Loan ID: ${loan['_id']}',
                              style: TextStyle(
                                fontSize: 16.sp,
                                fontWeight: FontWeight.w500,
                                color: Colors.black,
                              ),
                            ),
                            SizedBox(height: 8.h),
                            Text(
                              'Outstanding Amount: ₹${loan['outstandingAmount']}',
                              style: TextStyle(
                                fontSize: 16.sp,
                                fontWeight: FontWeight.bold,
                                color: Colors.green.shade700,
                              ),
                            ),
                            SizedBox(height: 16.h),
                            ElevatedButton.icon(
                              onPressed: () => _payFullLoan(loan),
                              icon: Icon(
                                Icons.payment,
                                size: 20.sp,
                              ),
                              label: Text(
                                'Pay Full Loan',
                                style: TextStyle(fontSize: 16.sp),
                              ),
                              style: ElevatedButton.styleFrom(
                                minimumSize: Size(double.infinity, 48.h),
                                backgroundColor: Colors.green,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8.r),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            if (msg.isNotEmpty)
              Padding(
                padding: EdgeInsets.only(top: 16.h),
                child: Text(
                  msg,
                  style: TextStyle(
                    color: msg.contains('successful') ? Colors.green : Colors.red,
                    fontWeight: FontWeight.w500,
                    fontSize: 14.sp,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
