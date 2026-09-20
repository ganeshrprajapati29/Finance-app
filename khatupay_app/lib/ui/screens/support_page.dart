import 'package:flutter/material.dart';

import '../../models/ticket.dart';
import '../../services/support_service.dart';
import '../widgets/app_back_button.dart';

class SupportPage extends StatefulWidget {
  final String? initialSubject;
  final String? initialMessage;

  const SupportPage({
    super.key,
    this.initialSubject,
    this.initialMessage,
  });

  @override
  State<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends State<SupportPage> {
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  bool _loading = true;
  bool _submitting = false;
  String? _message;
  List<Ticket> _tickets = [];

  @override
  void initState() {
    super.initState();
    _subjectController.text = widget.initialSubject ?? '';
    _messageController.text = widget.initialMessage ?? '';
    _loadTickets();
  }

  @override
  void dispose() {
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _loadTickets() async {
    setState(() => _loading = true);
    try {
      final tickets = await SupportService().myTickets();
      if (mounted) setState(() => _tickets = tickets);
    } catch (_) {
      if (mounted) {
        setState(() =>
            _message = 'Tickets load nahi ho paye. Please refresh karein.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createTicket() async {
    if (_formKey.currentState?.validate() != true) return;

    setState(() {
      _submitting = true;
      _message = null;
    });

    try {
      await SupportService().create(
        _subjectController.text.trim(),
        _messageController.text.trim(),
      );
      _subjectController.clear();
      _messageController.clear();
      await _loadTickets();
      if (mounted) {
        setState(() => _message = 'Support ticket created successfully');
      }
    } catch (_) {
      if (mounted) {
        setState(
            () => _message = 'Ticket create nahi ho paya. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _date(DateTime? value) {
    if (value == null) return 'N/A';
    return '${value.day.toString().padLeft(2, '0')}-${value.month.toString().padLeft(2, '0')}-${value.year}';
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return Colors.green;
      case 'IN_PROGRESS':
        return Colors.blue;
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final openTickets =
        _tickets.where((t) => t.status != 'RESOLVED' && t.status != 'CLOSED').length;

    return Scaffold(
      backgroundColor: const Color(0xFFF4F8F7),
      appBar: AppBar(
        title: const Text('Support'),
        leading: const AppBackButton(),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loadTickets,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadTickets,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _SupportHeader(
              openTickets: openTickets,
              totalTickets: _tickets.length,
            ),
            if (_message != null) ...[
              const SizedBox(height: 12),
              _MessageBanner(text: _message!),
            ],
            const SizedBox(height: 16),
            _CreateTicketCard(
              formKey: _formKey,
              subjectController: _subjectController,
              messageController: _messageController,
              submitting: _submitting,
              onSubmit: _createTicket,
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'My Tickets',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0B1220),
                    ),
                  ),
                ),
                TextButton.icon(
                  onPressed: _loading ? null : _loadTickets,
                  icon: const Icon(Icons.sync_rounded, size: 18),
                  label: const Text('Sync'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_tickets.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(18),
                  child: Text(
                    'No support tickets yet.',
                    style: TextStyle(color: Color(0xFF64748B)),
                  ),
                ),
              )
            else
              ..._tickets.map(
                (ticket) => _TicketCard(
                  ticket: ticket,
                  statusColor: _statusColor(ticket.status),
                  createdAt: _date(ticket.createdAt),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SupportHeader extends StatelessWidget {
  final int openTickets;
  final int totalTickets;

  const _SupportHeader({required this.openTickets, required this.totalTickets});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F766E), Color(0xFF14B8A6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F766E).withOpacity(0.18),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          const CircleAvatar(
            backgroundColor: Colors.white,
            child: Icon(Icons.headset_mic, color: Color(0xFF0F766E)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'We are here to help',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$openTickets open | $totalTickets total tickets',
                  style: const TextStyle(
                    color: Color(0xFFE6FFFA),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CreateTicketCard extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController subjectController;
  final TextEditingController messageController;
  final bool submitting;
  final VoidCallback onSubmit;

  const _CreateTicketCard({
    required this.formKey,
    required this.subjectController,
    required this.messageController,
    required this.submitting,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: Color(0xFFE6FFFA),
                    child: Icon(
                      Icons.support_agent_rounded,
                      color: Color(0xFF0F766E),
                    ),
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Raise Support Ticket',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Payment, recharge, bill and account issues can be reported here.',
                style: TextStyle(
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.w600,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: subjectController,
                validator: (v) =>
                    (v == null || v.trim().length < 3) ? 'Enter subject' : null,
                decoration: const InputDecoration(
                  labelText: 'Subject',
                  hintText: 'Example: Recharge payment pending',
                  prefixIcon: Icon(Icons.subject_rounded),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: messageController,
                minLines: 4,
                maxLines: 6,
                validator: (v) => (v == null || v.trim().length < 10)
                    ? 'Describe your issue'
                    : null,
                decoration: const InputDecoration(
                  labelText: 'Message',
                  hintText: 'Mention amount, mobile/account number and issue.',
                  prefixIcon: Icon(Icons.description_outlined),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: submitting ? null : onSubmit,
                  icon: submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.send),
                  label: Text(submitting ? 'Submitting...' : 'Submit Ticket'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  final Ticket ticket;
  final Color statusColor;
  final String createdAt;

  const _TicketCard({
    required this.ticket,
    required this.statusColor,
    required this.createdAt,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: statusColor.withOpacity(0.12),
          child: Icon(Icons.support_agent, color: statusColor),
        ),
        title: Text(
          ticket.subject,
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            '${ticket.message}\nCreated: $createdAt',
            style: const TextStyle(height: 1.35),
          ),
        ),
        isThreeLine: true,
        trailing: Chip(
          label: Text(ticket.status),
          labelStyle: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
          backgroundColor: statusColor,
        ),
      ),
    );
  }
}

class _MessageBanner extends StatelessWidget {
  final String text;

  const _MessageBanner({required this.text});

  @override
  Widget build(BuildContext context) {
    final success = text.toLowerCase().contains('success');
    final color = success ? Colors.green : Colors.orange;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.22)),
      ),
      child: Text(
        text,
        style: TextStyle(color: color, fontWeight: FontWeight.w800),
      ),
    );
  }
}
