import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../routes/app_router.dart';
import '../../services/virtual_card_service.dart';
import '../widgets/app_back_button.dart';

class VirtualCardsPage extends StatefulWidget {
  const VirtualCardsPage({super.key});

  @override
  State<VirtualCardsPage> createState() => _VirtualCardsPageState();
}

class _VirtualCardsPageState extends State<VirtualCardsPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _cards = [];
  String? _message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final cards = await VirtualCardService().myCards();
      if (mounted) setState(() => _cards = cards);
    } catch (e) {
      if (mounted) {
        setState(() => _message =
            friendlyErrorMessage(e, fallback: 'Unable to load cards.'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('KhatuPay Virtual Card'),
        leading: const AppBackButton(),
      ),
      floatingActionButton: _cards.isEmpty
          ? FloatingActionButton.extended(
              onPressed: () => router.go('/virtual-card/apply'),
              icon: const Icon(Icons.add_card),
              label: const Text('Apply'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            const _InfoBanner(),
            if (_message != null) ...[
              const SizedBox(height: 10),
              Text(_message!,
                  style: const TextStyle(
                      color: Colors.red, fontWeight: FontWeight.w800)),
            ],
            const SizedBox(height: 14),
            if (_loading)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(32),
                      child: CircularProgressIndicator()))
            else if (_cards.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(22),
                  child: Text(
                      'You do not have a virtual card yet. Apply and wait for KhatuPay approval.',
                      style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              )
            else
              ..._cards.map(
                  (card) => _VirtualCardTile(card: card, onChanged: _load)),
          ],
        ),
      ),
    );
  }
}

class VirtualCardApplyPage extends StatefulWidget {
  const VirtualCardApplyPage({super.key});

  @override
  State<VirtualCardApplyPage> createState() => _VirtualCardApplyPageState();
}

class _VirtualCardApplyPageState extends State<VirtualCardApplyPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _mobile = TextEditingController();
  final _email = TextEditingController();
  final _purpose = TextEditingController(text: 'Use for KhatuPay services');
  final _limit = TextEditingController(text: '10000');
  final Set<String> _services = {
    'BILLS',
    'RECHARGE',
    'QR',
    'LOAN_EMI',
    'WALLET'
  };
  bool _submitting = false;
  String? _message;

  @override
  void dispose() {
    _name.dispose();
    _mobile.dispose();
    _email.dispose();
    _purpose.dispose();
    _limit.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _message = null;
    });
    try {
      final result = await VirtualCardService().apply(
        cardholderName: _name.text.trim(),
        mobile: _mobile.text.trim(),
        email: _email.text.trim(),
        purpose: _purpose.text.trim(),
        monthlyLimit: double.tryParse(_limit.text.trim()) ?? 10000,
        allowedServices: _services.toList(),
      );
      if (!mounted) return;
      if (result['alreadyApplied'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'You already applied for a virtual card. Opening your existing card.')),
        );
      }
      router.go('/virtual-card');
    } catch (e) {
      if (mounted) {
        setState(() => _message = friendlyErrorMessage(e,
            fallback: 'Virtual card application failed.'));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    String? required(String? value) =>
        value == null || value.trim().isEmpty ? 'Required' : null;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Apply Virtual Card'),
        leading: const AppBackButton(fallbackRoute: '/virtual-card'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            const _InfoBanner(),
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Application Details',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _name,
                        validator: required,
                        decoration:
                            const InputDecoration(labelText: 'Name on Card')),
                    const SizedBox(height: 10),
                    TextFormField(
                        controller: _mobile,
                        validator: required,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(labelText: 'Mobile')),
                    const SizedBox(height: 10),
                    TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(labelText: 'Email')),
                    const SizedBox(height: 10),
                    TextFormField(
                        controller: _purpose,
                        validator: required,
                        decoration:
                            const InputDecoration(labelText: 'Purpose')),
                    const SizedBox(height: 10),
                    TextFormField(
                        controller: _limit,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Monthly KhatuPay Limit',
                            prefixText: 'Rs. ')),
                    const SizedBox(height: 16),
                    const Text('Allowed KhatuPay Services',
                        style: TextStyle(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        'BILLS',
                        'RECHARGE',
                        'QR',
                        'LOAN_EMI',
                        'WALLET'
                      ].map((service) {
                        return FilterChip(
                          selected: _services.contains(service),
                          label: Text(service.replaceAll('_', ' ')),
                          onSelected: (selected) {
                            setState(() {
                              if (selected) {
                                _services.add(service);
                              } else {
                                _services.remove(service);
                              }
                            });
                          },
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ),
            if (_message != null) ...[
              const SizedBox(height: 10),
              Text(_message!,
                  style: const TextStyle(
                      color: Colors.red, fontWeight: FontWeight.w800)),
            ],
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: const Icon(Icons.send),
              label: Text(_submitting ? 'Submitting...' : 'Submit Application'),
            ),
          ],
        ),
      ),
    );
  }
}

class _VirtualCardTile extends StatefulWidget {
  final Map<String, dynamic> card;
  final Future<void> Function() onChanged;

  const _VirtualCardTile({required this.card, required this.onChanged});

  @override
  State<_VirtualCardTile> createState() => _VirtualCardTileState();
}

class _VirtualCardTileState extends State<_VirtualCardTile> {
  bool _showDetails = false;
  bool _updating = false;
  String? _message;

  Future<void> _updateStatus(String action) async {
    final id = (widget.card['_id'] ?? widget.card['id'])?.toString();
    if (id == null || id.isEmpty) return;
    setState(() {
      _updating = true;
      _message = null;
    });
    try {
      await VirtualCardService().updateStatus(id, action);
      await widget.onChanged();
      if (mounted)
        setState(() => _message = 'Card status updated successfully');
    } catch (e) {
      if (mounted) setState(() => _message = e.toString());
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final card = widget.card;
    final status = card['status']?.toString() ?? 'APPLIED';
    final active = status == 'ACTIVE' || status == 'APPROVED';
    final frozen = status == 'FROZEN';
    final blocked = status == 'BLOCKED';
    final controllable = active || frozen || blocked;
    final number = _showDetails
        ? (card['cardNumber'] ?? card['cardNumberMasked'] ?? 'Pending')
        : (card['cardNumberMasked'] ?? 'XXXX XXXX XXXX XXXX');
    final cvv = _showDetails ? (card['cvv'] ?? '---') : '•••';
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [KhatuColors.deepTeal, KhatuColors.blue],
        ),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(.16),
              blurRadius: 24,
              offset: const Offset(0, 12))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14)),
                child: Image.asset('assets/khatulogo-removebg-preview.png'),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('KhatuPay Virtual Card',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w900)),
                    Text('Only for KhatuPay services',
                        style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              Chip(label: Text(status)),
            ],
          ),
          const SizedBox(height: 24),
          Text(
              number
                  .toString()
                  .replaceAllMapped(
                      RegExp(r'.{4}'), (match) => '${match.group(0)} ')
                  .trim(),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                  child: _CardField(
                      label: 'Name',
                      value:
                          card['cardholderName']?.toString() ?? 'CARD HOLDER')),
              _CardField(
                  label: 'Expiry',
                  value:
                      '${card['expiryMonth'] ?? '--'}/${card['expiryYear'] ?? '--'}'),
              const SizedBox(width: 18),
              _CardField(label: 'CVV', value: cvv),
            ],
          ),
          const SizedBox(height: 14),
          Text(
              'Limit Rs. ${card['monthlyLimit'] ?? 0} • ${(card['allowedServices'] as List? ?? []).join(', ')}',
              style: const TextStyle(
                  color: Colors.white70, fontWeight: FontWeight.w700)),
          if (_message != null) ...[
            const SizedBox(height: 10),
            Text(_message!,
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w800)),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: active
                      ? () => setState(() => _showDetails = !_showDetails)
                      : null,
                  icon: Icon(
                      _showDetails ? Icons.visibility_off : Icons.visibility),
                  label: Text(_showDetails ? 'Hide Details' : 'Show Details'),
                  style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white54)),
                ),
              ),
            ],
          ),
          if (controllable) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _updating || !active
                        ? null
                        : () => _updateStatus('FREEZE'),
                    icon: const Icon(Icons.ac_unit),
                    label: const Text('Freeze'),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white54)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _updating || (!frozen && !blocked && !active)
                        ? null
                        : () => _updateStatus(frozen ? 'UNFREEZE' : 'UNLOCK'),
                    icon: const Icon(Icons.lock_open),
                    label: const Text('Unlock'),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white54)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _updating || blocked
                        ? null
                        : () => _updateStatus('BLOCK'),
                    icon: const Icon(Icons.block),
                    label: Text(_updating ? 'Wait' : 'Block'),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white54)),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _CardField extends StatelessWidget {
  final String label;
  final String value;

  const _CardField({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: const TextStyle(
                color: Colors.white54,
                fontSize: 10,
                fontWeight: FontWeight.w900)),
        const SizedBox(height: 3),
        Text(value,
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w900)),
      ],
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFCD34D)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, color: KhatuColors.saffron),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'This is not a bank or RBI network card. It is a KhatuPay-only virtual service card and works only inside eligible KhatuPay services.',
              style: TextStyle(
                  color: Color(0xFF78350F), fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}
