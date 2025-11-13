import 'package:flutter/material.dart';
import '../../services/support_service.dart';
import '../../routes/app_router.dart';
import '../../models/ticket.dart';

class SupportPage extends StatefulWidget {
  const SupportPage({super.key});

  @override
  State<SupportPage> createState() => _S();
}

class _S extends State<SupportPage> {
  final s = TextEditingController(),
      m = TextEditingController();
  String msg = '';
  List<Ticket> tickets = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    loadTickets();
  }

  Future<void> loadTickets() async {
    try {
      final t = await SupportService().myTickets();
      setState(() {
        tickets = t;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Support'),
          leading: IconButton(
            icon: const Icon(Icons.home),
            onPressed: () => router.go('/'),
          ),
        ),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            TextField(
                controller: s,
                decoration: const InputDecoration(hintText: 'Subject')),
            TextField(
                controller: m,
                decoration: const InputDecoration(hintText: 'Message'),
                minLines: 3,
                maxLines: 5),
            const SizedBox(height: 8),
            ElevatedButton(
                onPressed: () async {
                  await SupportService().create(s.text, m.text);
                  setState(() => msg = 'Ticket created');
                  s.clear();
                  m.clear();
                  loadTickets();
                },
                child: const Text('Submit')),
            if (msg.isNotEmpty) Text(msg),
            const SizedBox(height: 16),
            const Text('My Tickets', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Expanded(
              child: loading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      itemCount: tickets.length,
                      itemBuilder: (context, index) {
                        final ticket = tickets[index];
                        return Card(
                          child: ListTile(
                            title: Text(ticket.subject),
                            subtitle: Text('${ticket.message}\nStatus: ${ticket.status}'),
                          ),
                        );
                      },
                    ),
            ),
          ]),
        ),
      );
}
