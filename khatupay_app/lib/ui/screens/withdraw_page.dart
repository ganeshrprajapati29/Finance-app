import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../providers/auth_providers.dart';
import '../../services/withdrawal_service.dart';
import '../../models/withdrawal_request.dart';
import '../../ui/widgets/k_button.dart';
import '../../ui/widgets/k_field.dart';

class WithdrawPage extends ConsumerStatefulWidget {
  const WithdrawPage({super.key});

  @override
  ConsumerState<WithdrawPage> createState() => _WithdrawPageState();
}

class _WithdrawPageState extends ConsumerState<WithdrawPage> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _bankNameController = TextEditingController();
  final _accountNumberController = TextEditingController();
  final _ifscController = TextEditingController();
  final _accountHolderController = TextEditingController();

  bool _isLoading = false;
  List<WithdrawalRequest> _withdrawals = [];

  @override
  void initState() {
    super.initState();
    _loadWithdrawals();
  }

  Future<void> _loadWithdrawals() async {
    try {
      final withdrawals = await WithdrawalService.getMyWithdrawals();
      setState(() => _withdrawals = withdrawals);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading withdrawals: $e')),
      );
    }
  }

  Future<void> _submitWithdrawal() async {
    if (!_formKey.currentState!.validate()) return;

    final user = ref.read(meProvider).value;
    if (user == null) return;

    final amount = num.parse(_amountController.text);
    if (amount > user.loanLimit) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Insufficient available balance')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      await WithdrawalService.createWithdrawal(
        amount: amount,
        bankDetails: {
          'bankName': _bankNameController.text,
          'accountNumber': _accountNumberController.text,
          'ifscCode': _ifscController.text,
          'accountHolderName': _accountHolderController.text,
        },
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Withdrawal request submitted')),
      );

      _clearForm();
      await _loadWithdrawals();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _clearForm() {
    _amountController.clear();
    _bankNameController.clear();
    _accountNumberController.clear();
    _ifscController.clear();
    _accountHolderController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(meProvider).value;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: Text(
          'Withdraw Funds',
          style: TextStyle(color: Colors.black, fontSize: 18.sp),
        ),
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (user != null) ...[
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12.r),
                ),
                child: ListTile(
                  contentPadding: EdgeInsets.all(16.w),
                  title: Text(
                    'Available Balance',
                    style: TextStyle(
                      fontSize: 16.sp,
                      fontWeight: FontWeight.w500,
                      color: Colors.blueAccent,
                    ),
                  ),
                  subtitle: Text(
                    '₹ ${user.loanLimit}',
                    style: TextStyle(
                      fontSize: 18.sp,
                      fontWeight: FontWeight.bold,
                      color: Colors.green.shade700,
                    ),
                  ),
                ),
              ),
              SizedBox(height: 16.h),
            ],
            Text(
              'Request Withdrawal',
              style: TextStyle(
                fontSize: 20.sp,
                fontWeight: FontWeight.bold,
                color: Colors.blueAccent,
              ),
            ),
            SizedBox(height: 16.h),
            Form(
              key: _formKey,
              child: Column(
                children: [
                  KField(
                    c: _amountController,
                    hint: 'Amount',
                  ),
                  SizedBox(height: 12.h),
                  KField(
                    c: _bankNameController,
                    hint: 'Bank Name',
                  ),
                  SizedBox(height: 12.h),
                  KField(
                    c: _accountNumberController,
                    hint: 'Account Number',
                  ),
                  SizedBox(height: 12.h),
                  KField(
                    c: _ifscController,
                    hint: 'IFSC Code',
                  ),
                  SizedBox(height: 12.h),
                  KField(
                    c: _accountHolderController,
                    hint: 'Account Holder Name',
                  ),
                  SizedBox(height: 16.h),
                  KButton(
                    text: 'Submit Request',
                    onPressed: _submitWithdrawal,
                    isLoading: _isLoading,
                  ),
                ],
              ),
            ),
            SizedBox(height: 24.h),
            Text(
              'My Withdrawal Requests',
              style: TextStyle(
                fontSize: 18.sp,
                fontWeight: FontWeight.bold,
                color: Colors.blueAccent,
              ),
            ),
            SizedBox(height: 8.h),
            ..._withdrawals.map((w) => Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12.r),
              ),
              margin: EdgeInsets.only(bottom: 8.h),
              child: ListTile(
                contentPadding: EdgeInsets.all(16.w),
                title: Text(
                  '₹ ${w.amount}',
                  style: TextStyle(
                    fontSize: 16.sp,
                    fontWeight: FontWeight.bold,
                    color: Colors.black,
                  ),
                ),
                subtitle: Text(
                  'Status: ${w.status}',
                  style: TextStyle(
                    fontSize: 14.sp,
                    color: Colors.grey.shade700,
                  ),
                ),
                trailing: Text(
                  w.createdAt?.toString().split(' ')[0] ?? '',
                  style: TextStyle(
                    fontSize: 12.sp,
                    color: Colors.grey,
                  ),
                ),
              ),
            )),
          ],
        ),
      ),
    );
  }
}
