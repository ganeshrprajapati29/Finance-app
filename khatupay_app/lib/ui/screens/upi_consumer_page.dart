import 'dart:convert';

import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../services/upi_consumer_service.dart';
import '../widgets/app_back_button.dart';

class UpiConsumerPage extends StatefulWidget {
  const UpiConsumerPage({super.key});

  @override
  State<UpiConsumerPage> createState() => _UpiConsumerPageState();
}

class _UpiConsumerPageState extends State<UpiConsumerPage>
    with SingleTickerProviderStateMixin {
  final _service = UpiConsumerService();
  late final TabController _tabs;

  final _mobile = TextEditingController();
  final _smsToken = TextEditingController();
  final _deviceId = TextEditingController(text: 'KHATUPAY_DEVICE');
  final _bankCode = TextEditingController();
  final _accountId = TextEditingController();
  final _payerVpa = TextEditingController();
  final _credBlock = TextEditingController();
  final _payeeVpa = TextEditingController();
  final _payeeName = TextEditingController();
  final _amount = TextEditingController();
  final _remarks = TextEditingController(text: 'Khatu Pay');
  final _collectFrom = TextEditingController();
  final _collectTo = TextEditingController();
  final _collectAmount = TextEditingController();
  final _upiNumber = TextEditingController();
  final _statusRequestId = TextEditingController();
  final _complaintRequestId = TextEditingController();
  final _complaintReason = TextEditingController();

  bool _loading = false;
  Map<String, dynamic>? _setup;
  Map<String, dynamic>? _lastResponse;
  String? _message;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 7, vsync: this);
    _loadSetup();
  }

  @override
  void dispose() {
    _tabs.dispose();
    for (final c in [
      _mobile,
      _smsToken,
      _deviceId,
      _bankCode,
      _accountId,
      _payerVpa,
      _credBlock,
      _payeeVpa,
      _payeeName,
      _amount,
      _remarks,
      _collectFrom,
      _collectTo,
      _collectAmount,
      _upiNumber,
      _statusRequestId,
      _complaintRequestId,
      _complaintReason,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadSetup() async {
    await _run(() async {
      final data = await _service.setup();
      _setup = data;
      _message = data['configured'] == true
          ? 'UPI Consumer Stack ready'
          : 'Juspay credentials will be added after approval.';
      return data;
    });
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() action) async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final data = await action();
      if (!mounted) return;
      setState(() {
        _lastResponse = data;
        _message = _message ?? 'Request completed';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _lastResponse = null;
        _message = e.toString();
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final configured = _setup?['configured'] == true;
    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Khatu UPI'),
        leading: const AppBackButton(fallbackRoute: '/'),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(text: 'Home'),
            Tab(text: 'Accounts'),
            Tab(text: 'Pay'),
            Tab(text: 'PIN'),
            Tab(text: 'Collect'),
            Tab(text: 'UPI No.'),
            Tab(text: 'Help'),
          ],
        ),
      ),
      body: Column(
        children: [
          _StatusStrip(
              configured: configured, loading: _loading, message: _message),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                _homeTab(configured),
                _accountsTab(),
                _payTab(),
                _pinTab(),
                _collectTab(),
                _upiNumberTab(),
                _helpTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _homeTab(bool configured) {
    return _PagePad(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: KhatuColors.line),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 18,
                  offset: const Offset(0, 8)),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14)),
                child: Image.asset('assets/khatulogo-removebg-preview.png'),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Khatu UPI',
                        style: TextStyle(
                            color: KhatuColors.text,
                            fontSize: 20,
                            fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Text(
                      configured
                          ? 'Bank account, balance and payments ready'
                          : 'Waiting for Juspay Consumer approval',
                      style: const TextStyle(
                          color: KhatuColors.muted,
                          fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 0.94,
          children: [
            _QuickTile(Icons.link, 'Bind Device', () => _tabs.animateTo(1),
                KhatuColors.teal),
            _QuickTile(Icons.account_balance, 'Accounts',
                () => _tabs.animateTo(1), const Color(0xFF2563EB)),
            _QuickTile(Icons.currency_rupee, 'Balance',
                () => _tabs.animateTo(1), KhatuColors.saffron),
            _QuickTile(Icons.send, 'Send', () => _tabs.animateTo(2),
                const Color(0xFF16A34A)),
            _QuickTile(Icons.person_search, 'Verify VPA',
                () => _tabs.animateTo(2), const Color(0xFF7C3AED)),
            _QuickTile(Icons.pin_outlined, 'UPI PIN', () => _tabs.animateTo(3),
                const Color(0xFF0F766E)),
            _QuickTile(Icons.call_received, 'Request', () => _tabs.animateTo(4),
                const Color(0xFFE11D48)),
            _QuickTile(Icons.pin, 'UPI Number', () => _tabs.animateTo(5),
                const Color(0xFF0891B2)),
            _QuickTile(Icons.support_agent, 'UDIR', () => _tabs.animateTo(6),
                const Color(0xFF475569)),
          ],
        ),
        const SizedBox(height: 14),
        _ResponseCard(data: _setup, title: 'Setup Status'),
        _ResponseCard(data: _lastResponse, title: 'Last Response'),
      ],
    );
  }

  Widget _accountsTab() {
    return _PagePad(
      children: [
        _Section('Customer Onboarding'),
        _field(_mobile, 'Registered Mobile', '10 digit mobile',
            Icons.phone_android,
            number: true),
        _field(_deviceId, 'Device Fingerprint', 'Device binding id',
            Icons.devices),
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: _loading
                    ? null
                    : () => _run(() => _service.smsToken(
                        mobile: _mobile.text.trim(),
                        deviceFingerPrint: _deviceId.text.trim())),
                icon: const Icon(Icons.sms),
                label: const Text('Get SMS Token'),
              ),
            ),
          ],
        ),
        _field(
            _smsToken, 'SMS Token', 'Token from device binding SMS', Icons.key),
        ElevatedButton.icon(
          onPressed: _loading
              ? null
              : () => _run(() => _service.bindDevice(
                  mobile: _mobile.text.trim(),
                  smsToken: _smsToken.text.trim(),
                  deviceFingerPrint: _deviceId.text.trim())),
          icon: const Icon(Icons.link),
          label: const Text('Bind Device'),
        ),
        const SizedBox(height: 18),
        _Section('Bank Accounts'),
        _field(_bankCode, 'Bank Code', 'Optional bank code',
            Icons.account_balance),
        ElevatedButton.icon(
          onPressed: _loading
              ? null
              : () => _run(() => _service.fetchAccounts(
                  mobile: _mobile.text.trim(),
                  deviceFingerPrint: _deviceId.text.trim(),
                  bankCode: _bankCode.text.trim())),
          icon: const Icon(Icons.manage_search),
          label: const Text('Fetch Bank Accounts'),
        ),
        const SizedBox(height: 12),
        _field(_accountId, 'Bank Account Unique ID',
            'From fetch accounts response', Icons.badge),
        _field(_payerVpa, 'Payer VPA', 'yourname@bank', Icons.alternate_email),
        _field(
            _credBlock, 'Cred Block', 'Generated by UPI PIN SDK', Icons.lock),
        ElevatedButton.icon(
          onPressed: _loading
              ? null
              : () => _run(() => _service.checkBalance(
                  bankAccountUniqueId: _accountId.text.trim(),
                  payerVpa: _payerVpa.text.trim(),
                  credBlock: _credBlock.text.trim(),
                  deviceFingerPrint: _deviceId.text.trim())),
          icon: const Icon(Icons.account_balance_wallet),
          label: const Text('Check Balance'),
        ),
        _ResponseCard(data: _lastResponse, title: 'Account Response'),
      ],
    );
  }

  Widget _payTab() {
    return _PagePad(
      children: [
        _Section('Verify & Send Money'),
        _field(_payeeVpa, 'Payee UPI ID', 'name@bank', Icons.alternate_email),
        OutlinedButton.icon(
          onPressed: _loading
              ? null
              : () => _run(() => _service.verifyVpa(_payeeVpa.text.trim())),
          icon: const Icon(Icons.verified_user),
          label: const Text('Verify UPI ID'),
        ),
        _field(_payeeName, 'Verified Name', 'Fetched payee name', Icons.person),
        _field(_amount, 'Amount', 'Rs.', Icons.currency_rupee, number: true),
        _field(_remarks, 'Remark', 'Payment note', Icons.note_alt),
        _field(_accountId, 'Bank Account Unique ID', 'Debit account id',
            Icons.badge),
        _field(_payerVpa, 'Payer VPA', 'yourname@bank', Icons.alternate_email),
        _field(_credBlock, 'Cred Block', 'UPI PIN SDK output', Icons.lock),
        ElevatedButton.icon(
          onPressed: _loading
              ? null
              : () => _run(() => _service.sendMoney(
                    bankAccountUniqueId: _accountId.text.trim(),
                    payerVpa: _payerVpa.text.trim(),
                    payeeVpa: _payeeVpa.text.trim(),
                    payeeName: _payeeName.text.trim(),
                    amount: double.tryParse(_amount.text.trim()) ?? 0,
                    credBlock: _credBlock.text.trim(),
                    deviceFingerPrint: _deviceId.text.trim(),
                    remarks: _remarks.text.trim(),
                  )),
          icon: const Icon(Icons.send),
          label: const Text('Send Money'),
        ),
        _ResponseCard(data: _lastResponse, title: 'Payment Response'),
      ],
    );
  }

  Widget _collectTab() {
    return _PagePad(
      children: [
        _Section('Request Money'),
        _field(_collectFrom, 'Payer UPI ID', 'Customer UPI ID',
            Icons.alternate_email),
        _field(
            _collectTo, 'Your UPI ID', 'Khatu Pay user VPA', Icons.person_pin),
        _field(_collectAmount, 'Amount', 'Rs.', Icons.currency_rupee,
            number: true),
        ElevatedButton.icon(
          onPressed: _loading
              ? null
              : () => _run(() => _service.requestMoney(
                    payerVpa: _collectFrom.text.trim(),
                    payeeVpa: _collectTo.text.trim(),
                    amount: double.tryParse(_collectAmount.text.trim()) ?? 0,
                  )),
          icon: const Icon(Icons.call_received),
          label: const Text('Request Money'),
        ),
        _ResponseCard(data: _lastResponse, title: 'Collect Response'),
      ],
    );
  }

  Widget _pinTab() {
    return _PagePad(
      children: [
        _Section('UPI PIN / MPIN'),
        const _InfoCard(
          icon: Icons.lock,
          title: 'Secure PIN Flow',
          text:
              'The UPI PIN screen will generate a credBlock via the PSP/NPCI SDK. After approval, the same field will be submitted to the backend.',
        ),
        _field(_accountId, 'Bank Account Unique ID',
            'From fetch accounts response', Icons.badge),
        _field(_payerVpa, 'Payer VPA', 'yourname@bank', Icons.alternate_email),
        _field(
            _deviceId, 'Device Fingerprint', 'Bound device id', Icons.devices),
        _field(
            _credBlock, 'Cred Block', 'Generated by UPI PIN SDK', Icons.lock),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ElevatedButton.icon(
              onPressed: _loading
                  ? null
                  : () => _run(() => _service.setMpin(
                        bankAccountUniqueId: _accountId.text.trim(),
                        payerVpa: _payerVpa.text.trim(),
                        credBlock: _credBlock.text.trim(),
                        deviceFingerPrint: _deviceId.text.trim(),
                      )),
              icon: const Icon(Icons.add_moderator),
              label: const Text('Set PIN'),
            ),
            ElevatedButton.icon(
              onPressed: _loading
                  ? null
                  : () => _run(() => _service.changeMpin(
                        bankAccountUniqueId: _accountId.text.trim(),
                        payerVpa: _payerVpa.text.trim(),
                        credBlock: _credBlock.text.trim(),
                        deviceFingerPrint: _deviceId.text.trim(),
                      )),
              icon: const Icon(Icons.sync_lock),
              label: const Text('Change PIN'),
            ),
            OutlinedButton.icon(
              onPressed: _loading
                  ? null
                  : () => _run(() => _service.resetMpin(
                        bankAccountUniqueId: _accountId.text.trim(),
                        payerVpa: _payerVpa.text.trim(),
                        credBlock: _credBlock.text.trim(),
                        deviceFingerPrint: _deviceId.text.trim(),
                      )),
              icon: const Icon(Icons.lock_reset),
              label: const Text('Reset PIN'),
            ),
          ],
        ),
        _ResponseCard(data: _lastResponse, title: 'PIN Response'),
      ],
    );
  }

  Widget _upiNumberTab() {
    return _PagePad(
      children: [
        _Section('UPI Number / Mapper'),
        _field(
            _upiNumber, 'UPI Number', 'Mobile or chosen UPI number', Icons.pin),
        _field(_payerVpa, 'Linked VPA', 'yourname@bank', Icons.alternate_email),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ElevatedButton.icon(
              onPressed: _loading
                  ? null
                  : () => _run(
                      () => _service.checkUpiNumber(_upiNumber.text.trim())),
              icon: const Icon(Icons.search),
              label: const Text('Check'),
            ),
            ElevatedButton.icon(
              onPressed: _loading
                  ? null
                  : () => _run(() => _service.createUpiNumber(
                      _upiNumber.text.trim(), _payerVpa.text.trim())),
              icon: const Icon(Icons.add),
              label: const Text('Create'),
            ),
          ],
        ),
        _ResponseCard(data: _lastResponse, title: 'UPI Number Response'),
      ],
    );
  }

  Widget _helpTab() {
    return _PagePad(
      children: [
        _Section('Transaction Status'),
        _field(_statusRequestId, 'Merchant Request ID',
            'Transaction request id', Icons.receipt_long),
        ElevatedButton.icon(
          onPressed: _loading
              ? null
              : () => _run(() =>
                  _service.transactionStatus(_statusRequestId.text.trim())),
          icon: const Icon(Icons.manage_search),
          label: const Text('Check Status'),
        ),
        const SizedBox(height: 16),
        _Section('UPI Lite'),
        ElevatedButton.icon(
          onPressed: _loading
              ? null
              : () => _run(() => _service.upiLiteStatus(
                  bankAccountUniqueId: _accountId.text.trim(),
                  payerVpa: _payerVpa.text.trim())),
          icon: const Icon(Icons.flash_on),
          label: const Text('UPI Lite Status'),
        ),
        const SizedBox(height: 16),
        _Section('Complaints / UDIR'),
        _field(_complaintRequestId, 'Original Request ID',
            'Failed transaction id', Icons.confirmation_number),
        _field(_complaintReason, 'Reason', 'Complaint reason',
            Icons.report_problem),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ElevatedButton.icon(
              onPressed: _loading
                  ? null
                  : () => _run(() => _service.raiseComplaint(
                      originalMerchantRequestId:
                          _complaintRequestId.text.trim(),
                      reason: _complaintReason.text.trim())),
              icon: const Icon(Icons.support_agent),
              label: const Text('Raise'),
            ),
            OutlinedButton.icon(
              onPressed: _loading
                  ? null
                  : () => _run(() => _service
                      .complaintStatus(_complaintRequestId.text.trim())),
              icon: const Icon(Icons.search),
              label: const Text('Status'),
            ),
          ],
        ),
        _ResponseCard(data: _lastResponse, title: 'Help Response'),
      ],
    );
  }

  Widget _field(TextEditingController controller, String label, String hint,
      IconData icon,
      {bool number = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        keyboardType: number ? TextInputType.number : TextInputType.text,
        decoration: InputDecoration(
            labelText: label, hintText: hint, prefixIcon: Icon(icon)),
      ),
    );
  }
}

class _StatusStrip extends StatelessWidget {
  final bool configured;
  final bool loading;
  final String? message;

  const _StatusStrip(
      {required this.configured, required this.loading, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: configured ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          if (loading)
            const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2))
          else
            Icon(configured ? Icons.check_circle : Icons.info,
                color: configured ? Colors.green : KhatuColors.saffron,
                size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message ?? (configured ? 'Ready' : 'Credentials required'),
              style: TextStyle(
                  color: configured
                      ? Colors.green.shade800
                      : Colors.orange.shade900,
                  fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

class _PagePad extends StatelessWidget {
  final List<Widget> children;

  const _PagePad({required this.children});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: children,
    );
  }
}

class _Section extends StatelessWidget {
  final String title;

  const _Section(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(title,
          style: const TextStyle(
              color: KhatuColors.text,
              fontSize: 17,
              fontWeight: FontWeight.w900)),
    );
  }
}

class _QuickTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final Color color;

  const _QuickTile(this.icon, this.title, this.onTap, this.color);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
              border: Border.all(color: KhatuColors.line),
              borderRadius: BorderRadius.circular(14)),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                  backgroundColor: color.withOpacity(0.12),
                  child: Icon(icon, color: color)),
              const SizedBox(height: 8),
              Text(title,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w900)),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String text;

  const _InfoCard(
      {required this.icon, required this.title, required this.text});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              backgroundColor: KhatuColors.teal.withOpacity(0.12),
              child: Icon(icon, color: KhatuColors.teal),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Text(text,
                      style: const TextStyle(
                          color: KhatuColors.muted,
                          fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResponseCard extends StatelessWidget {
  final Map<String, dynamic>? data;
  final String title;

  const _ResponseCard({required this.data, required this.title});

  @override
  Widget build(BuildContext context) {
    if (data == null) return const SizedBox.shrink();
    const encoder = JsonEncoder.withIndent('  ');
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            SelectableText(
              encoder.convert(data),
              style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
