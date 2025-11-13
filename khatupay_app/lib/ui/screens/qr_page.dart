import 'package:flutter/material.dart';
import '../../services/qr_service.dart';
import '../../routes/app_router.dart';

class QRPage extends StatefulWidget {
  const QRPage({super.key});

  @override
  State<QRPage> createState() => _S();
}

class _S extends State<QRPage> {
  String? imgUrl;
  final amt = TextEditingController(text: '100'),
      note = TextEditingController(text: 'Repayment'),
      vpa = TextEditingController(text: 'user@upi'),
      name = TextEditingController(text: 'User Name');
  List<Map<String, dynamic>> history = [];
  bool loading = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    try {
      final h = await QRService().getHistory();
      setState(() => history = h);
    } catch (e) {
      // Handle error silently
    }
  }

  Future<void> _generate() async {
    setState(() => loading = true);
    try {
      final r = await QRService().generate(
          vpa: vpa.text,
          name: name.text,
          amount: num.parse(amt.text),
          note: note.text);
      setState(() => imgUrl = r['imagePath']);
      _loadHistory(); // Refresh history
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('UPI QR'),
          leading: IconButton(
            icon: const Icon(Icons.home),
            onPressed: () => router.go('/'),
          ),
        ),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            TextField(
                controller: vpa,
                decoration: const InputDecoration(hintText: 'UPI ID (e.g., user@upi)')),
            const SizedBox(height: 8),
            TextField(
                controller: name,
                decoration: const InputDecoration(hintText: 'Payee Name')),
            const SizedBox(height: 8),
            TextField(
                controller: amt,
                decoration: const InputDecoration(hintText: 'Amount')),
            const SizedBox(height: 8),
            TextField(
                controller: note,
                decoration: const InputDecoration(hintText: 'Note')),
            const SizedBox(height: 8),
            ElevatedButton(
                onPressed: loading ? null : _generate,
                child: loading ? const CircularProgressIndicator() : const Text('Generate Khatu Pay QR')),
            const SizedBox(height: 12),
            if (imgUrl != null)
              Column(
                children: [
                  const Text('Generated QR Code:', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Image.network(imgUrl!.startsWith('http')
                      ? imgUrl!
                      : 'http://192.168.29.124:8080${imgUrl!}'),
                  const SizedBox(height: 16),
                ],
              ),
            const Divider(),
            const Text('QR History:', style: TextStyle(fontWeight: FontWeight.bold)),
            Expanded(
              child: ListView.builder(
                itemCount: history.length,
                itemBuilder: (context, index) {
                  final item = history[index];
                  return ListTile(
                    title: Text('${item['payload']['pn']} - ₹${item['payload']['amount'] ?? 'N/A'}'),
                    subtitle: Text(item['createdAt'] ?? ''),
                    trailing: IconButton(
                      icon: const Icon(Icons.qr_code),
                      onPressed: () => setState(() => imgUrl = item['imagePath']),
                    ),
                  );
                },
              ),
            ),
          ]),
        ),
      );
}
