import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_providers.dart';
import '../../routes/app_router.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

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
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: Colors.white,
              elevation: 2,
              child: ListTile(
                title: const Text('Loan Limit',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('₹ ${u.loanLimit}',
                    style: const TextStyle(fontSize: 16)),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _tile('Apply Loan', Icons.add, '/apply'),
                _tile('My Loans', Icons.list, '/loans'),
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: SizedBox(
          width: 150,
          height: 100,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: Colors.blueAccent, size: 30),
                const SizedBox(height: 8),
                Text(title,
                    style: const TextStyle(
                        color: Colors.black, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
