import 'package:flutter/material.dart';
import 'package:flutter_easyloading/flutter_easyloading.dart';
import 'package:open_file/open_file.dart';
import '../../core/app_theme.dart';
import '../../routes/app_router.dart';
import '../../services/payment_chat_service.dart';
import '../../services/payment_service.dart';
import '../../services/pdf_service.dart';
import '../widgets/app_back_button.dart';

class PaymentChatsPage extends StatefulWidget {
  const PaymentChatsPage({super.key});

  @override
  State<PaymentChatsPage> createState() => _PaymentChatsPageState();
}

class _PaymentChatsPageState extends State<PaymentChatsPage> {
  final _service = PaymentChatService();
  final _search = TextEditingController();
  bool _loading = true;
  bool _resolving = false;
  List<Map<String, dynamic>> _threads = [];
  Map<String, dynamic>? _resolved;
  String? _message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _service.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final threads = await _service.threads();
      if (mounted) setState(() => _threads = threads);
    } catch (e) {
      if (mounted) setState(() => _message = 'Unable to load chats: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resolve() async {
    if (_search.text.trim().isEmpty) return;
    setState(() {
      _resolving = true;
      _resolved = null;
      _message = null;
    });
    try {
      final user = await _service.resolve(_search.text.trim());
      if (mounted) setState(() => _resolved = user);
    } catch (e) {
      if (mounted) setState(() => _message = 'Receiver not found: $e');
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  Future<void> _openResolved() async {
    final user = _resolved;
    if (user == null) return;
    final thread = await _service.startThread(
      mobile: user['mobile']?.toString(),
      upiId: user['upiId']?.toString(),
    );
    if (!mounted) return;
    router.go('/payment-chat/${thread['_id']}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pay Chats'),
        leading: const AppBackButton(),
        actions: [
          IconButton(onPressed: () => router.go('/payment-chat-history'), icon: const Icon(Icons.receipt_long)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Start payment chat', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _search,
                      keyboardType: TextInputType.text,
                      decoration: InputDecoration(
                        labelText: 'Mobile number or UPI ID',
                        suffixIcon: _resolving
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                              )
                            : IconButton(onPressed: _resolve, icon: const Icon(Icons.search)),
                      ),
                      onSubmitted: (_) => _resolve(),
                    ),
                    if (_message != null) ...[
                      const SizedBox(height: 10),
                      Text(_message!, style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w800)),
                    ],
                    if (_resolved != null) ...[
                      const SizedBox(height: 12),
                      _PeerTile(peer: _resolved!, onTap: _openResolved),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text('Recent chats', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            if (_loading)
              const Center(child: Padding(padding: EdgeInsets.all(28), child: CircularProgressIndicator()))
            else if (_threads.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(22),
                  child: Text('You have no payment chats yet.', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              )
            else
              ..._threads.map((thread) {
                final peer = Map<String, dynamic>.from(thread['peer'] ?? {});
                return _PeerTile(
                  peer: peer,
                  subtitle: thread['lastMessage']?.toString() ?? 'Tap to chat and pay',
                  onTap: () => router.go('/payment-chat/${thread['_id']}'),
                );
              }),
          ],
        ),
      ),
    );
  }
}

class PaymentChatThreadPage extends StatefulWidget {
  final String threadId;

  const PaymentChatThreadPage({super.key, required this.threadId});

  @override
  State<PaymentChatThreadPage> createState() => _PaymentChatThreadPageState();
}

class _PaymentChatThreadPageState extends State<PaymentChatThreadPage> {
  final _chat = PaymentChatService();
  final _payment = PaymentService();
  final _text = TextEditingController();
  final _amount = TextEditingController();
  final _note = TextEditingController(text: 'KhatuPay transfer');
  final _scroll = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic>? _thread;
  bool _loading = true;
  String? _message;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _text.dispose();
    _amount.dispose();
    _note.dispose();
    _scroll.dispose();
    _payment.dispose();
    _chat.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    await _load();
    await _chat.connect(
      onMessage: (message) {
        if (message['threadId']?.toString() == widget.threadId && mounted) {
          setState(() => _upsertMessage(message));
          _jump();
        }
      },
      onPaymentUpdate: (message) {
        if (message['threadId']?.toString() == widget.threadId && mounted) {
          setState(() {
            final index = _messages.indexWhere((item) => item['_id'] == message['_id']);
            if (index >= 0) {
              _messages[index] = message;
            } else {
              _messages.add(message);
            }
          });
          _jump();
        }
      },
    );
    _chat.join(widget.threadId);
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _chat.thread(widget.threadId),
        _chat.messages(widget.threadId),
      ]);
      if (mounted) {
        setState(() {
          _thread = Map<String, dynamic>.from(results[0] as Map);
          _messages = List<Map<String, dynamic>>.from(results[1] as List);
        });
      }
      _jump();
    } catch (e) {
      if (mounted) setState(() => _message = 'Unable to load messages: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _jump() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  void _upsertMessage(Map<String, dynamic> message) {
    final id = message['_id']?.toString();
    if (id != null && id.isNotEmpty) {
      final index = _messages.indexWhere((item) => item['_id']?.toString() == id);
      if (index >= 0) {
        _messages[index] = message;
        return;
      }
    }
    _messages.add(message);
  }

  Future<void> _sendText() async {
    final text = _text.text.trim();
    if (text.isEmpty) return;
    _text.clear();
    final message = await _chat.sendMessage(widget.threadId, text);
    if (mounted) {
      setState(() => _messages.add(message));
      _jump();
    }
  }

  Future<void> _pay() async {
    final amount = double.tryParse(_amount.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _message = 'Please enter a valid amount');
      return;
    }
    try {
      final data = await _chat.createPaymentOrder(widget.threadId, amount, _note.text.trim());
      final createdMessage = Map<String, dynamic>.from(data['message'] ?? {});
      setState(() {
        _messages.add(createdMessage);
        _message = 'Opening payment gateway...';
      });
      _jump();
      await _payment.openGatewayCheckout(data);
      if (!mounted) return;
      _amount.clear();
      setState(() => _message =
          'Payment started. Chat payment status will update after confirmation.');
      await _load();
    } catch (e) {
      if (mounted) setState(() => _message = 'Payment error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final peer = Map<String, dynamic>.from(_thread?['peer'] ?? {});
    final peerName = (peer['name'] ?? 'Payment Chat').toString();
    final peerSub = [
      peer['upiId']?.toString(),
      peer['bankName']?.toString(),
    ].where((item) => item != null && item.isNotEmpty).join(' • ');

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: Colors.white,
              child: Text(peerName.isEmpty ? 'K' : peerName[0].toUpperCase(), style: const TextStyle(color: KhatuColors.teal, fontWeight: FontWeight.w900)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(peerName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  if (peerSub.isNotEmpty) Text(peerSub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: Colors.white70)),
                ],
              ),
            ),
          ],
        ),
        leading: const AppBackButton(fallbackRoute: '/payment-chats'),
      ),
      body: Column(
        children: [
          if (_message != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              color: _message!.toLowerCase().contains('success') ? Colors.green.shade50 : Colors.orange.shade50,
              child: Text(_message!, style: const TextStyle(fontWeight: FontWeight.w800)),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : Stack(
                    children: [
                      const _ChatWatermark(),
                      ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(14, 14, 14, 18),
                        itemCount: _messageItemCount,
                        itemBuilder: (context, index) {
                          final entry = _messageEntry(index);
                          if (entry is String) return _DateSeparator(label: entry);
                          final message = entry as Map<String, dynamic>;
                          return _MessageBubble(message: message, peerId: peer['id']?.toString());
                        },
                      ),
                    ],
                  ),
          ),
          _PaymentComposer(amount: _amount, note: _note, onPay: _pay),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _text,
                      minLines: 1,
                      maxLines: 3,
                      decoration: const InputDecoration(hintText: 'Message', border: OutlineInputBorder()),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(onPressed: _sendText, icon: const Icon(Icons.send)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  int get _messageItemCount {
    if (_messages.isEmpty) return 0;
    var count = 0;
    String? lastDay;
    for (final message in _messages) {
      final day = _dayLabel(message['createdAt']?.toString());
      if (day != lastDay) {
        count++;
        lastDay = day;
      }
      count++;
    }
    return count;
  }

  Object _messageEntry(int targetIndex) {
    var cursor = 0;
    String? lastDay;
    for (final message in _messages) {
      final day = _dayLabel(message['createdAt']?.toString());
      if (day != lastDay) {
        if (cursor == targetIndex) return day;
        cursor++;
        lastDay = day;
      }
      if (cursor == targetIndex) return message;
      cursor++;
    }
    return _messages.last;
  }

  String _dayLabel(String? value) {
    final date = DateTime.tryParse(value ?? '')?.toLocal();
    if (date == null) return 'Today';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDay = DateTime(date.year, date.month, date.day);
    if (msgDay == today) return 'Today';
    if (msgDay == today.subtract(const Duration(days: 1))) return 'Yesterday';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}

class PaymentChatHistoryPage extends StatefulWidget {
  const PaymentChatHistoryPage({super.key});

  @override
  State<PaymentChatHistoryPage> createState() => _PaymentChatHistoryPageState();
}

class _PaymentChatHistoryPageState extends State<PaymentChatHistoryPage> {
  final _service = PaymentChatService();
  bool _loading = true;
  List<Map<String, dynamic>> _payments = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final payments = await _service.paymentHistory();
      if (mounted) setState(() => _payments = payments);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _receipt(Map<String, dynamic> payment) async {
    EasyLoading.show(status: 'Generating receipt...');
    try {
      final file = await PdfService().generateKhatuPayChatReceipt(payment);
      EasyLoading.dismiss();
      await OpenFile.open(file.path);
    } catch (e) {
      EasyLoading.showError('Receipt failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat Payment History'),
        leading: const AppBackButton(fallbackRoute: '/payment-chats'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _payments.length,
                itemBuilder: (context, index) {
                  final payment = _payments[index];
                  final payee = Map<String, dynamic>.from(payment['payeeDetails'] ?? {});
                  return Card(
                    child: ListTile(
                      leading: const Icon(Icons.payments, color: KhatuColors.teal),
                      title: Text(payee['name']?.toString() ?? 'UPI Payment', style: const TextStyle(fontWeight: FontWeight.w900)),
                      subtitle: Text('${payment['khatuPaymentId'] ?? ''}\n${payee['vpa'] ?? ''} • ${payee['bankName'] ?? 'UPI Linked Bank'}'),
                      isThreeLine: true,
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('Rs. ${payment['amount']}', style: const TextStyle(fontWeight: FontWeight.w900)),
                          Text(payment['status']?.toString() ?? '', style: TextStyle(color: payment['status'] == 'CONFIRMED' ? Colors.green : Colors.orange)),
                        ],
                      ),
                      onTap: () => _receipt(payment),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class _PeerTile extends StatelessWidget {
  final Map<String, dynamic> peer;
  final String? subtitle;
  final VoidCallback onTap;

  const _PeerTile({required this.peer, required this.onTap, this.subtitle});

  @override
  Widget build(BuildContext context) {
    final name = peer['name']?.toString() ?? 'KhatuPay User';
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: KhatuColors.teal,
          child: Text(name.isEmpty ? 'K' : name[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text(subtitle ?? '${peer['upiId'] ?? ''} • ${peer['bankName'] ?? 'UPI Linked Bank'}'),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Map<String, dynamic> message;
  final String? peerId;

  const _MessageBubble({required this.message, required this.peerId});

  @override
  Widget build(BuildContext context) {
    final isPayment = message['kind'] == 'PAYMENT';
    final senderId = message['senderId']?.toString();
    final incoming = peerId != null && senderId == peerId;
    final alignment = incoming ? Alignment.centerLeft : Alignment.centerRight;
    final time = _timeText(message['createdAt']?.toString());
    if (isPayment) {
      final meta = Map<String, dynamic>.from(message['meta'] ?? {});
      return Align(
        alignment: alignment,
        child: Container(
          width: MediaQuery.of(context).size.width * .78,
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: incoming ? Colors.white : const Color(0xFFECFDF5),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: incoming ? KhatuColors.line : const Color(0xFFA7F3D0)),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(.04), blurRadius: 10, offset: const Offset(0, 4))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.verified, color: Color(0xFF16A34A)),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Rs. ${message['amount']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900))),
                ],
              ),
              const SizedBox(height: 8),
              Text('To ${meta['payeeName'] ?? 'UPI User'}', style: const TextStyle(fontWeight: FontWeight.w800)),
              Text('${meta['payeeVpa'] ?? ''} • ${meta['bankName'] ?? 'UPI Linked Bank'}', style: const TextStyle(color: KhatuColors.muted)),
              const Divider(),
              Text('ID: ${message['khatuPaymentId'] ?? ''}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              Row(
                children: [
                  Expanded(
                    child: Text(message['paymentStatus']?.toString() ?? 'PENDING', style: TextStyle(color: message['paymentStatus'] == 'CONFIRMED' ? Colors.green : Colors.orange, fontWeight: FontWeight.w900)),
                  ),
                  Text(time, style: const TextStyle(color: KhatuColors.muted, fontSize: 11, fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
        ),
      );
    }
    return Align(
      alignment: alignment,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .76),
        decoration: BoxDecoration(
          color: incoming ? Colors.white : KhatuColors.teal,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(incoming ? 4 : 16),
            bottomRight: Radius.circular(incoming ? 16 : 4),
          ),
          border: incoming ? Border.all(color: KhatuColors.line) : null,
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(.04), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message['text']?.toString() ?? '',
              style: TextStyle(color: incoming ? KhatuColors.text : Colors.white, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(time, style: TextStyle(color: incoming ? KhatuColors.muted : Colors.white70, fontSize: 10, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }

  String _timeText(String? value) {
    final date = DateTime.tryParse(value ?? '')?.toLocal();
    if (date == null) return '';
    final hour = date.hour % 12 == 0 ? 12 : date.hour % 12;
    final minute = date.minute.toString().padLeft(2, '0');
    final suffix = date.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $suffix';
  }
}

class _DateSeparator extends StatelessWidget {
  final String label;

  const _DateSeparator({required this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.only(bottom: 12, top: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(color: Colors.white.withOpacity(.88), borderRadius: BorderRadius.circular(999), border: Border.all(color: KhatuColors.line)),
        child: Text(label, style: const TextStyle(color: KhatuColors.muted, fontSize: 12, fontWeight: FontWeight.w900)),
      ),
    );
  }
}

class _ChatWatermark extends StatelessWidget {
  const _ChatWatermark();

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: IgnorePointer(
        child: Center(
          child: Opacity(
            opacity: .055,
            child: Image.asset(
              'assets/khatulogo-removebg-preview.png',
              width: MediaQuery.of(context).size.width * .62,
              fit: BoxFit.contain,
            ),
          ),
        ),
      ),
    );
  }
}

class _PaymentComposer extends StatelessWidget {
  final TextEditingController amount;
  final TextEditingController note;
  final VoidCallback onPay;

  const _PaymentComposer({required this.amount, required this.note, required this.onPay});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: KhatuColors.line))),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: amount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(prefixText: 'Rs. ', labelText: 'Amount'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(controller: note, decoration: const InputDecoration(labelText: 'Note')),
          ),
          const SizedBox(width: 8),
          ElevatedButton.icon(onPressed: onPay, icon: const Icon(Icons.payments), label: const Text('Pay')),
        ],
      ),
    );
  }
}
