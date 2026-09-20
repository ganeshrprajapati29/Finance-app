import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../routes/app_router.dart';
import '../../services/payment_service.dart';
import '../../services/qr_service.dart';
import '../../services/qr_sticker_order_service.dart';
import '../widgets/app_back_button.dart';

class QRStickerOrderPage extends StatefulWidget {
  final String? qrId;

  const QRStickerOrderPage({super.key, this.qrId});

  @override
  State<QRStickerOrderPage> createState() => _QRStickerOrderPageState();
}

class _QRStickerOrderPageState extends State<QRStickerOrderPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _mobile = TextEditingController();
  final _line1 = TextEditingController();
  final _line2 = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _pincode = TextEditingController();
  final _landmark = TextEditingController();
  final _note = TextEditingController();
  final _payment = PaymentService();

  Map<String, dynamic>? _config;
  List<Map<String, dynamic>> _qrHistory = [];
  String? _selectedQrId;
  String _stickerType = 'STANDARD';
  String _addressType = 'SHOP';
  int _quantity = 2;
  bool _loading = true;
  bool _submitting = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _selectedQrId = widget.qrId;
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _mobile.dispose();
    _line1.dispose();
    _line2.dispose();
    _city.dispose();
    _state.dispose();
    _pincode.dispose();
    _landmark.dispose();
    _note.dispose();
    _payment.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        QRStickerOrderService().getConfig(),
        QRService().getHistory(),
      ]);
      if (!mounted) return;
      final history = (results[1] as List).cast<Map<String, dynamic>>();
      setState(() {
        _config = Map<String, dynamic>.from(results[0] as Map);
        _qrHistory = history;
        _selectedQrId ??= history.isNotEmpty
            ? (history.first['_id'] ?? history.first['id'])?.toString()
            : null;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _message =
            friendlyErrorMessage(e, fallback: 'Unable to load details.'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _unitPrice {
    final prices = Map<String, dynamic>.from(_config?['prices'] ?? {});
    return NumberParser.toDouble(prices[_stickerType]);
  }

  int get _freeRemaining => NumberParser.toInt(_config?['freeRemaining']);
  int get _freeQuantity =>
      _quantity < _freeRemaining ? _quantity : _freeRemaining;
  int get _chargeableQuantity => (_quantity - _freeQuantity).clamp(0, 999);
  double get _subtotal => _chargeableQuantity * _unitPrice;
  double get _delivery =>
      _subtotal > 0 ? NumberParser.toDouble(_config?['deliveryCharge']) : 0;
  double get _total => _subtotal + _delivery;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedQrId == null || _selectedQrId!.isEmpty) {
      setState(() => _message =
          'Please order a sticker only after your KhatuPay QR is ready.');
      return;
    }

    setState(() {
      _submitting = true;
      _message = null;
    });

    try {
      final data = await QRStickerOrderService().createOrder(
        qrCodeId: _selectedQrId,
        stickerType: _stickerType,
        quantity: _quantity,
        shippingAddress: {
          'name': _name.text.trim(),
          'mobile': _mobile.text.trim(),
          'line1': _line1.text.trim(),
          'line2': _line2.text.trim(),
          'city': _city.text.trim(),
          'state': _state.text.trim(),
          'pincode': _pincode.text.trim(),
          'landmark': _landmark.text.trim(),
        },
        userNote: _note.text.trim(),
      );
      final order = Map<String, dynamic>.from(data['order'] ?? {});
      final checkout = data['checkout'];
      if (checkout == null || _total <= 0) {
        if (!mounted) return;
        router.go('/qr-sticker-orders');
        return;
      }

      final checkoutMap = Map<String, dynamic>.from(checkout);
      await _payment.openGatewayCheckout(checkoutMap);
      if (mounted) router.go('/qr-sticker-orders');
    } catch (e) {
      if (mounted) {
        setState(() => _message =
            friendlyErrorMessage(e, fallback: 'Unable to create order.'));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Order QR Stickers'),
        leading: const AppBackButton(fallbackRoute: '/qr'),
        actions: [
          IconButton(
              onPressed: () => router.go('/qr-sticker-orders'),
              icon: const Icon(Icons.history)),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            _PlanCard(
              freeRemaining: _freeRemaining,
              quantity: _quantity,
              stickerType: _stickerType,
              onQuantity: (value) => setState(() => _quantity = value),
              onType: (value) => setState(() => _stickerType = value),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Select QR',
                        style: TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    const Text(
                        'The sticker will be printed for your automatic KhatuPay QR. The latest active QR is selected by default.',
                        style: TextStyle(
                            color: KhatuColors.muted,
                            fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _selectedQrId,
                      items: _qrHistory.map((qr) {
                        final payload =
                            Map<String, dynamic>.from(qr['payload'] ?? {});
                        final id = (qr['_id'] ?? qr['id']).toString();
                        final title = (payload['merchantVpa'] ??
                                payload['pa'] ??
                                payload['pn'] ??
                                'KhatuPay QR')
                            .toString();
                        return DropdownMenuItem(
                            value: id,
                            child:
                                Text(title, overflow: TextOverflow.ellipsis));
                      }).toList(),
                      onChanged: (value) =>
                          setState(() => _selectedQrId = value),
                      decoration:
                          const InputDecoration(border: OutlineInputBorder()),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            _AddressCard(
              name: _name,
              mobile: _mobile,
              line1: _line1,
              line2: _line2,
              city: _city,
              state: _state,
              pincode: _pincode,
              landmark: _landmark,
              note: _note,
              addressType: _addressType,
              onAddressType: (value) => setState(() => _addressType = value),
            ),
            const SizedBox(height: 12),
            _PriceCard(
              freeQuantity: _freeQuantity,
              chargeableQuantity: _chargeableQuantity,
              unitPrice: _unitPrice,
              delivery: _delivery,
              total: _total,
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
              icon: Icon(_total > 0 ? Icons.payments : Icons.check_circle),
              label: Text(_submitting
                  ? 'Processing...'
                  : (_total > 0
                      ? 'Pay Rs. ${_total.toStringAsFixed(0)} & Order'
                      : 'Place Free Order')),
            ),
          ],
        ),
      ),
    );
  }
}

class QRStickerOrdersPage extends StatefulWidget {
  const QRStickerOrdersPage({super.key});

  @override
  State<QRStickerOrdersPage> createState() => _QRStickerOrdersPageState();
}

class _QRStickerOrdersPageState extends State<QRStickerOrdersPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _orders = [];
  String? _message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final orders = await QRStickerOrderService().getOrders();
      if (mounted) setState(() => _orders = orders);
    } catch (e) {
      if (mounted) {
        setState(() => _message =
            friendlyErrorMessage(e, fallback: 'Unable to load orders.'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sticker Orders'),
        leading: const AppBackButton(fallbackRoute: '/qr'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => router.go('/qr-sticker-order'),
        icon: const Icon(Icons.add),
        label: const Text('Order'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_message != null)
                    Text(_message!, style: const TextStyle(color: Colors.red)),
                  if (_orders.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(22),
                        child: Text('You have no sticker orders yet.',
                            style: TextStyle(fontWeight: FontWeight.w800)),
                      ),
                    )
                  else
                    ..._orders.map((order) => _OrderTile(order: order)),
                ],
              ),
      ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  final Map<String, dynamic> order;

  const _OrderTile({required this.order});

  @override
  Widget build(BuildContext context) {
    final address = Map<String, dynamic>.from(order['shippingAddress'] ?? {});
    final tracking = Map<String, dynamic>.from(order['tracking'] ?? {});
    return Card(
      child: ListTile(
        leading: const Icon(Icons.qr_code_2, color: KhatuColors.teal),
        title: Text(order['orderNo']?.toString() ?? 'Sticker Order',
            style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text(
          '${order['quantity']} stickers • ${order['orderStatus']} • ${order['paymentStatus']}\n'
          '${address['city'] ?? ''} ${address['pincode'] ?? ''}'
          '${tracking['trackingNumber'] == null ? '' : '\nTracking: ${tracking['trackingNumber']}'}',
        ),
        trailing: Text(
            'Rs. ${NumberParser.toDouble(order['totalAmount']).toStringAsFixed(0)}'),
        isThreeLine: true,
        onTap: () => router.go('/qr-sticker-orders/${order['_id']}'),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final int freeRemaining;
  final int quantity;
  final String stickerType;
  final ValueChanged<int> onQuantity;
  final ValueChanged<String> onType;

  const _PlanCard({
    required this.freeRemaining,
    required this.quantity,
    required this.stickerType,
    required this.onQuantity,
    required this.onType,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Professional QR Stickers',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text(
                '$freeRemaining stickers available for free. A per-sticker charge applies after that.',
                style: const TextStyle(
                    color: KhatuColors.muted, fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                    value: 'STANDARD',
                    label: Text('Standard'),
                    icon: Icon(Icons.sticky_note_2)),
                ButtonSegment(
                    value: 'PREMIUM',
                    label: Text('Premium'),
                    icon: Icon(Icons.verified)),
                ButtonSegment(
                    value: 'SHOP_BOARD',
                    label: Text('Board'),
                    icon: Icon(Icons.storefront)),
              ],
              selected: {stickerType},
              onSelectionChanged: (values) => onType(values.first),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                const Text('Quantity',
                    style: TextStyle(fontWeight: FontWeight.w900)),
                const Spacer(),
                IconButton.outlined(
                    onPressed:
                        quantity <= 1 ? null : () => onQuantity(quantity - 1),
                    icon: const Icon(Icons.remove)),
                SizedBox(
                    width: 46,
                    child: Center(
                        child: Text('$quantity',
                            style: const TextStyle(
                                fontSize: 18, fontWeight: FontWeight.w900)))),
                IconButton.outlined(
                    onPressed:
                        quantity >= 100 ? null : () => onQuantity(quantity + 1),
                    icon: const Icon(Icons.add)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AddressCard extends StatelessWidget {
  final TextEditingController name;
  final TextEditingController mobile;
  final TextEditingController line1;
  final TextEditingController line2;
  final TextEditingController city;
  final TextEditingController state;
  final TextEditingController pincode;
  final TextEditingController landmark;
  final TextEditingController note;
  final String addressType;
  final ValueChanged<String> onAddressType;

  const _AddressCard({
    required this.name,
    required this.mobile,
    required this.line1,
    required this.line2,
    required this.city,
    required this.state,
    required this.pincode,
    required this.landmark,
    required this.note,
    required this.addressType,
    required this.onAddressType,
  });

  @override
  Widget build(BuildContext context) {
    InputDecoration decoration(String label) =>
        InputDecoration(labelText: label, border: const OutlineInputBorder());
    String? requiredText(String? value) =>
        value == null || value.trim().isEmpty ? 'Required' : null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Delivery Address',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            const Text(
                'The courier partner will receive your complete address, so please fill in your shop/home details clearly.',
                style: TextStyle(
                    color: KhatuColors.muted, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                    value: 'SHOP',
                    label: Text('Shop'),
                    icon: Icon(Icons.storefront)),
                ButtonSegment(
                    value: 'HOME', label: Text('Home'), icon: Icon(Icons.home)),
                ButtonSegment(
                    value: 'OFFICE',
                    label: Text('Office'),
                    icon: Icon(Icons.business)),
              ],
              selected: {addressType},
              onSelectionChanged: (values) => onAddressType(values.first),
            ),
            const SizedBox(height: 12),
            TextFormField(
                controller: name,
                validator: requiredText,
                decoration: decoration('Contact Name')),
            const SizedBox(height: 10),
            TextFormField(
                controller: mobile,
                validator: requiredText,
                keyboardType: TextInputType.phone,
                decoration: decoration('Mobile')),
            const SizedBox(height: 10),
            TextFormField(
                controller: line1,
                validator: requiredText,
                decoration: decoration('Address Line 1')),
            const SizedBox(height: 10),
            TextFormField(
                controller: line2, decoration: decoration('Address Line 2')),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                    child: TextFormField(
                        controller: city,
                        validator: requiredText,
                        decoration: decoration('City'))),
                const SizedBox(width: 10),
                Expanded(
                    child: TextFormField(
                        controller: state,
                        validator: requiredText,
                        decoration: decoration('State'))),
              ],
            ),
            const SizedBox(height: 10),
            TextFormField(
                controller: pincode,
                validator: requiredText,
                keyboardType: TextInputType.number,
                decoration: decoration('Pincode')),
            const SizedBox(height: 10),
            TextFormField(
                controller: landmark, decoration: decoration('Landmark')),
            const SizedBox(height: 10),
            TextFormField(
                controller: note, decoration: decoration('Order Note')),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.verified_user, color: Color(0xFF16A34A)),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                        'Your order, address, payment, and tracking details will stay visible live on KhatuPay.',
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF065F46))),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class QRStickerOrderDetailPage extends StatefulWidget {
  final String id;

  const QRStickerOrderDetailPage({super.key, required this.id});

  @override
  State<QRStickerOrderDetailPage> createState() =>
      _QRStickerOrderDetailPageState();
}

class _QRStickerOrderDetailPageState extends State<QRStickerOrderDetailPage> {
  bool _loading = true;
  Map<String, dynamic>? _order;
  String? _message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final order = await QRStickerOrderService().getOrder(widget.id);
      if (mounted) setState(() => _order = order);
    } catch (e) {
      if (mounted) {
        setState(() => _message =
            friendlyErrorMessage(e, fallback: 'Unable to load order.'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _cancel() async {
    final order = _order;
    if (order == null) return;
    try {
      await QRStickerOrderService().cancelOrder(order['_id'].toString());
      await _load();
      if (mounted) setState(() => _message = 'Order cancelled successfully');
    } catch (e) {
      if (mounted) setState(() => _message = 'Cancel failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    final address = Map<String, dynamic>.from(order?['shippingAddress'] ?? {});
    final tracking = Map<String, dynamic>.from(order?['tracking'] ?? {});
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sticker Order Details'),
        leading: const AppBackButton(fallbackRoute: '/qr-sticker-orders'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_message != null) _DetailBanner(text: _message!),
                if (order == null)
                  const Card(
                      child: Padding(
                          padding: EdgeInsets.all(18),
                          child: Text('Order not found')))
                else ...[
                  _StatusHero(order: order),
                  const SizedBox(height: 12),
                  _DetailCard(
                    title: 'Order Summary',
                    rows: {
                      'Order No': order['orderNo']?.toString() ?? '',
                      'Sticker Type': order['stickerType']?.toString() ?? '',
                      'Quantity': '${order['quantity'] ?? 0}',
                      'Free / Paid':
                          '${order['freeQuantity'] ?? 0} free, ${order['chargeableQuantity'] ?? 0} paid',
                      'Total':
                          'Rs. ${NumberParser.toDouble(order['totalAmount']).toStringAsFixed(0)}',
                      'Payment': order['paymentStatus']?.toString() ?? '',
                    },
                  ),
                  const SizedBox(height: 12),
                  _DetailCard(
                    title: 'Delivery Address',
                    rows: {
                      'Name': address['name']?.toString() ?? '',
                      'Mobile': address['mobile']?.toString() ?? '',
                      'Address':
                          '${address['line1'] ?? ''} ${address['line2'] ?? ''}',
                      'City':
                          '${address['city'] ?? ''}, ${address['state'] ?? ''} - ${address['pincode'] ?? ''}',
                      'Landmark': address['landmark']?.toString() ?? 'N/A',
                    },
                  ),
                  const SizedBox(height: 12),
                  _DetailCard(
                    title: 'Tracking',
                    rows: {
                      'Courier':
                          tracking['courierName']?.toString() ?? 'Pending',
                      'Tracking No':
                          tracking['trackingNumber']?.toString() ?? 'Pending',
                      'Status': order['orderStatus']?.toString() ?? '',
                    },
                  ),
                  if (['PAYMENT_PENDING', 'PLACED', 'CONFIRMED']
                      .contains(order['orderStatus'])) ...[
                    const SizedBox(height: 14),
                    OutlinedButton.icon(
                        onPressed: _cancel,
                        icon: const Icon(Icons.cancel),
                        label: const Text('Cancel Order')),
                  ],
                ],
              ],
            ),
    );
  }
}

class _StatusHero extends StatelessWidget {
  final Map<String, dynamic> order;

  const _StatusHero({required this.order});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
            colors: [KhatuColors.deepTeal, KhatuColors.teal]),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          const CircleAvatar(
              backgroundColor: Colors.white,
              child: Icon(Icons.sticky_note_2, color: KhatuColors.teal)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(order['orderStatus']?.toString() ?? 'ORDER',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 21,
                        fontWeight: FontWeight.w900)),
                Text(order['orderNo']?.toString() ?? '',
                    style: const TextStyle(
                        color: Colors.white70, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailCard extends StatelessWidget {
  final String title;
  final Map<String, String> rows;

  const _DetailCard({required this.title, required this.rows});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style:
                    const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            ...rows.entries.map((entry) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                          width: 104,
                          child: Text(entry.key,
                              style: const TextStyle(
                                  color: KhatuColors.muted,
                                  fontWeight: FontWeight.w800))),
                      Expanded(
                          child: Text(entry.value,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800))),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }
}

class _DetailBanner extends StatelessWidget {
  final String text;

  const _DetailBanner({required this.text});

  @override
  Widget build(BuildContext context) {
    final success = text.toLowerCase().contains('success');
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: success ? Colors.green.shade50 : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: success ? Colors.green.shade200 : Colors.orange.shade200),
      ),
      child: Text(text,
          style: TextStyle(
              color: success ? Colors.green.shade900 : Colors.orange.shade900,
              fontWeight: FontWeight.w800)),
    );
  }
}

class _PriceCard extends StatelessWidget {
  final int freeQuantity;
  final int chargeableQuantity;
  final double unitPrice;
  final double delivery;
  final double total;

  const _PriceCard({
    required this.freeQuantity,
    required this.chargeableQuantity,
    required this.unitPrice,
    required this.delivery,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _PriceRow(label: 'Free stickers', value: '$freeQuantity'),
            _PriceRow(
                label: 'Paid stickers',
                value:
                    '$chargeableQuantity x Rs. ${unitPrice.toStringAsFixed(0)}'),
            _PriceRow(
                label: 'Delivery', value: 'Rs. ${delivery.toStringAsFixed(0)}'),
            const Divider(),
            _PriceRow(
                label: 'Payable',
                value: 'Rs. ${total.toStringAsFixed(0)}',
                strong: true),
          ],
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  final String label;
  final String value;
  final bool strong;

  const _PriceRow(
      {required this.label, required this.value, this.strong = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Text(label,
              style: TextStyle(
                  fontWeight: strong ? FontWeight.w900 : FontWeight.w700)),
          const Spacer(),
          Text(value,
              style: TextStyle(
                  fontWeight: strong ? FontWeight.w900 : FontWeight.w700)),
        ],
      ),
    );
  }
}

class NumberParser {
  static double toDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  static int toInt(dynamic value) {
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}
