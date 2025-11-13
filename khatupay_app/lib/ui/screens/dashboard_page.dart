import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../providers/auth_providers.dart';
import '../../routes/app_router.dart';
import '../../services/notification_service.dart';
import '../../core/api_client.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  Future<int> _getUnreadCount() async {
    try {
      return await NotificationService.getUnreadCount();
    } catch (e) {
      return 0;
    }
  }

  Future<List<dynamic>> _getRecentP2PPayments() async {
    try {
      // Use a simple HTTP client for now since PaymentService._dio is private
      final response = await ApiClient.client.get('/payments');
      final payments = response.data['data'] as List<dynamic>;
      return payments.where((p) => p['type'] == 'P2P').toList();
    } catch (e) {
      return [];
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);

    return Scaffold(
      backgroundColor: Colors.white, // ✅ White background
      appBar: AppBar(
        backgroundColor: Colors.white, // ✅ White AppBar
        elevation: 1,
        title: const Text(
          'Khatu Pay',
          style: TextStyle(color: Colors.black), // ✅ Black text on white
        ),
        // ✅ Proper Back Button — always visible, and works for both router & navigator
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              router.go('/'); // fallback to home if nothing to pop
            }
          },
        ),
        actions: [
          FutureBuilder<int>(
            future: _getUnreadCount(),
            builder: (context, snapshot) {
              final count = snapshot.data ?? 0;
              return Stack(
                children: [
                  IconButton(
                    onPressed: () => router.go('/notifications'),
                    icon: const Icon(Icons.notifications, color: Colors.black),
                  ),
                  if (count > 0)
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Text(
                          count > 99 ? '99+' : count.toString(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          IconButton(
            onPressed: () => router.go('/profile'),
            icon: const Icon(Icons.person, color: Colors.black),
          ),
          IconButton(
            onPressed: () => router.go('/settings'),
            icon: const Icon(Icons.settings, color: Colors.black),
          ),
        ],
      ),
      body: me.when(
        data: (u) => ListView(
          padding: EdgeInsets.all(16.w),
          children: [
            Card(
              color: Colors.white,
              elevation: 2,
              child: ListTile(
                title: Text('Loan Limit',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16.sp)),
                subtitle: Text('₹ ${u.loanLimit}',
                    style: TextStyle(fontSize: 14.sp)),
              ),
            ),
            SizedBox(height: 12.h),
            Card(
              color: Colors.white,
              elevation: 2,
              child: ListTile(
                title: Text('Available Balance',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16.sp)),
                subtitle: Text('₹ ${u.loanLimit}',
                    style: TextStyle(fontSize: 14.sp)),
              ),
            ),
            SizedBox(height: 12.h),
            // Add P2P Payments Card
            Card(
              color: Colors.white,
              elevation: 2,
              child: Padding(
                padding: EdgeInsets.all(16.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Recent P2P Payments',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16.sp),
                    ),
                    SizedBox(height: 8.h),
                    FutureBuilder<List<dynamic>>(
                      future: _getRecentP2PPayments(),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return SizedBox(
                            height: 50.h,
                            child: const Center(child: CircularProgressIndicator()),
                          );
                        }
                        final payments = snapshot.data ?? [];
                        if (payments.isEmpty) {
                          return Text(
                            'No recent P2P payments',
                            style: TextStyle(color: Colors.grey, fontSize: 14.sp),
                          );
                        }
                        return Column(
                          children: payments.take(3).map((payment) => ListTile(
                            dense: true,
                            leading: const Icon(Icons.swap_horiz, color: Colors.green),
                            title: Text(
                              'To: ${payment['payeeDetails']?['name'] ?? 'Unknown'}',
                              style: TextStyle(fontSize: 14.sp),
                            ),
                            subtitle: Text(
                              '${payment['createdAt']?.split('T')[0] ?? ''}',
                              style: TextStyle(fontSize: 12.sp, color: Colors.grey),
                            ),
                            trailing: Text(
                              '₹${payment['amount']}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.green,
                                fontSize: 14.sp,
                              ),
                            ),
                          )).toList(),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 12.h),
            Wrap(
              spacing: 12.w,
              runSpacing: 12.h,
              children: [
                _tile('Apply Loan', Icons.add, '/apply'),
                _tile('My Loans', Icons.list, '/loans'),
                _tile('Pay Loan', Icons.payment, '/pay-loan'),
                _tile('Withdraw', Icons.account_balance_wallet, '/withdraw'),
                _tile('Payments', Icons.currency_rupee, '/payments'),
                _tile('Bills', Icons.receipt_long, '/bills'),
                _tile('QR', Icons.qr_code, '/qr'),
                _tile('FAQs', Icons.help, '/faq'),
                _tile('Support', Icons.support_agent, '/support'),
              ],
            ),
          ],
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }

  Widget _tile(String title, IconData icon, String route) {
    return InkWell(
      onTap: () => router.go(route),
      child: Card(
        color: Colors.white,
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
        child: SizedBox(
          width: 150.w,
          height: 100.h,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: Colors.blueAccent, size: 30.sp),
                SizedBox(height: 8.h),
                Text(title,
                    style: TextStyle(
                        color: Colors.black, fontWeight: FontWeight.w500, fontSize: 14.sp)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
