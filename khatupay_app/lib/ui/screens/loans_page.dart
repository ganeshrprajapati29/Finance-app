import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../providers/loan_providers.dart';
import '../../routes/app_router.dart';

class LoansPage extends ConsumerWidget {
  const LoansPage({super.key});

  Color _getStatusColor(String status) {
    switch (status) {
      case 'PENDING':
        return Colors.orange;
      case 'APPROVED':
        return Colors.green;
      case 'REJECTED':
        return Colors.red;
      case 'DISBURSED':
        return Colors.blue;
      case 'CLOSED':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'PENDING':
        return Icons.hourglass_empty;
      case 'APPROVED':
        return Icons.check_circle;
      case 'REJECTED':
        return Icons.cancel;
      case 'DISBURSED':
        return Icons.account_balance_wallet;
      case 'CLOSED':
        return Icons.done_all;
      default:
        return Icons.help;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loans = ref.watch(myLoansProvider);
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: Text(
          'My Loans',
          style: TextStyle(color: Colors.black, fontSize: 18.sp),
        ),
        iconTheme: const IconThemeData(color: Colors.black),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: Colors.blueAccent, size: 24.sp),
            onPressed: () => ref.invalidate(myLoansProvider),
          ),
        ],
      ),
      body: loans.when(
        data: (list) => list.isEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.account_balance_wallet,
                      size: 80.sp,
                      color: Colors.grey.shade400,
                    ),
                    SizedBox(height: 16.h),
                    Text(
                      'No loans yet',
                      style: TextStyle(
                        fontSize: 18.sp,
                        color: Colors.grey,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    SizedBox(height: 8.h),
                    Text(
                      'Apply for your first loan!',
                      style: TextStyle(
                        fontSize: 14.sp,
                        color: Colors.grey,
                      ),
                    ),
                    SizedBox(height: 24.h),
                    ElevatedButton(
                      onPressed: () => router.go('/apply'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blueAccent,
                        foregroundColor: Colors.white,
                        padding: EdgeInsets.symmetric(horizontal: 32.w, vertical: 12.h),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8.r),
                        ),
                      ),
                      child: Text(
                        'Apply Now',
                        style: TextStyle(fontSize: 16.sp),
                      ),
                    ),
                  ],
                ),
              )
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(myLoansProvider),
                child: ListView.builder(
                  padding: EdgeInsets.symmetric(vertical: 8.h),
                  itemCount: list.length,
                  itemBuilder: (c, i) {
                    final l = list[i];
                    return Card(
                      margin: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
                      elevation: 2,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12.r),
                      ),
                      child: ListTile(
                        contentPadding: EdgeInsets.all(16.w),
                        leading: CircleAvatar(
                          radius: 24.r,
                          backgroundColor: _getStatusColor(l.status).withOpacity(0.2),
                          child: Icon(
                            _getStatusIcon(l.status),
                            color: _getStatusColor(l.status),
                            size: 24.sp,
                          ),
                        ),
                        title: Row(
                          children: [
                            Text(
                              '₹${l.application.amountRequested.toStringAsFixed(0)}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16.sp,
                                color: Colors.black,
                              ),
                            ),
                            SizedBox(width: 8.w),
                            Container(
                              padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                              decoration: BoxDecoration(
                                color: _getStatusColor(l.status).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12.r),
                              ),
                              child: Text(
                                l.status,
                                style: TextStyle(
                                  color: _getStatusColor(l.status),
                                  fontSize: 12.sp,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(height: 4.h),
                            Text(
                              'Tenure: ${l.application.tenureMonths} months',
                              style: TextStyle(
                                fontSize: 14.sp,
                                color: Colors.grey.shade700,
                              ),
                            ),
                            if (l.decision != null) ...[
                              SizedBox(height: 4.h),
                              Text(
                                'Approved: ₹${l.decision!.amountApproved?.toStringAsFixed(0) ?? 'N/A'} @ ${l.decision!.rateAPR?.toStringAsFixed(1) ?? 'N/A'}% APR',
                                style: TextStyle(
                                  fontSize: 12.sp,
                                  color: Colors.green.shade700,
                                ),
                              ),
                            ],
                            SizedBox(height: 2.h),
                            Text(
                              'Applied: ${l.createdAt?.toLocal().toString().split(' ')[0] ?? 'N/A'}',
                              style: TextStyle(
                                fontSize: 12.sp,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                        trailing: Icon(
                          Icons.arrow_forward_ios,
                          size: 16.sp,
                          color: Colors.grey,
                        ),
                        onTap: () => router.go('/loan/${l.id}'),
                      ),
                    );
                  },
                ),
              ),
        loading: () => Center(
          child: CircularProgressIndicator(
            color: Colors.blueAccent,
          ),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error,
                size: 80.sp,
                color: Colors.red.shade400,
              ),
              SizedBox(height: 16.h),
              Text(
                'Error: $e',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16.sp,
                  color: Colors.grey,
                ),
              ),
              SizedBox(height: 16.h),
              ElevatedButton(
                onPressed: () => ref.invalidate(myLoansProvider),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blueAccent,
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(horizontal: 32.w, vertical: 12.h),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8.r),
                  ),
                ),
                child: Text(
                  'Retry',
                  style: TextStyle(fontSize: 16.sp),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
