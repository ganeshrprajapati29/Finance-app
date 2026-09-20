import 'package:flutter/services.dart';

/// Models for the five recharge & bill services (Mobile, DTH, Credit Card,
/// Electricity, FASTag), mirroring `/api/services/*`.
///
/// Every parser is null-tolerant: a missing or oddly typed field falls back to
/// a safe default instead of throwing, so one bad row from the API can never
/// crash a payment screen.

String _text(dynamic value) => value?.toString().trim() ?? '';

double _double(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(_text(value).replaceAll(',', '')) ?? 0;
}

int _int(dynamic value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(_text(value)) ?? fallback;
}

bool _bool(dynamic value, [bool fallback = false]) {
  if (value is bool) return value;
  final text = _text(value).toLowerCase();
  if (text == 'true') return true;
  if (text == 'false') return false;
  return fallback;
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

List<Map<String, dynamic>> _maps(dynamic value) => value is List
    ? value.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList()
    : const [];

DateTime? _date(dynamic value) {
  final text = _text(value);
  return text.isEmpty ? null : DateTime.tryParse(text)?.toLocal();
}

/// One input a provider needs (e.g. "Consumer number"), sent to ClubAPI as
/// [key] (`mobile` or `opvalue1`..`opvalue5`).
class ServiceField {
  const ServiceField({
    required this.key,
    required this.label,
    this.placeholder = '',
    this.hint = '',
    this.inputType = 'text',
    this.minLength = 0,
    this.maxLength = 64,
    this.pattern = '',
    this.uppercase = false,
  });

  factory ServiceField.fromJson(Map<String, dynamic> json) => ServiceField(
        key: _text(json['key']).isEmpty ? 'mobile' : _text(json['key']),
        label: _text(json['label']).isEmpty ? 'Account number' : _text(json['label']),
        placeholder: _text(json['placeholder']),
        hint: _text(json['hint']),
        inputType: _text(json['inputType']).isEmpty ? 'text' : _text(json['inputType']),
        minLength: _int(json['minLength']),
        maxLength: _int(json['maxLength'], 64).clamp(1, 64),
        pattern: _text(json['pattern']),
        uppercase: _bool(json['uppercase']),
      );

  final String key;
  final String label;
  final String placeholder;
  final String hint;
  final String inputType;
  final int minLength;
  final int maxLength;
  final String pattern;
  final bool uppercase;

  bool get isNumeric => inputType == 'mobile' || inputType == 'number';

  TextInputType get keyboardType => isNumeric ? TextInputType.number : TextInputType.text;

  List<TextInputFormatter> get formatters => [
        if (isNumeric) FilteringTextInputFormatter.digitsOnly,
        if (!isNumeric) FilteringTextInputFormatter.deny(RegExp(r'\s')),
        LengthLimitingTextInputFormatter(maxLength),
        if (uppercase) const _UpperCaseFormatter(),
      ];

  /// Mirrors the server's normalisation so client and server agree on what
  /// "valid" means.
  String normalize(String raw) {
    var value = raw.trim();
    value = isNumeric ? value.replaceAll(RegExp(r'[\s-]'), '') : value.replaceAll(RegExp(r'\s+'), '');
    return uppercase ? value.toUpperCase() : value;
  }

  /// Returns an error message, or null when [raw] is valid.
  String? validate(String raw) {
    final value = normalize(raw);
    if (value.isEmpty) return 'Enter ${label.toLowerCase()}';
    if (isNumeric && !RegExp(r'^\d+$').hasMatch(value)) {
      return '$label should contain digits only';
    }
    if (minLength > 0 && value.length < minLength) {
      return minLength == maxLength
          ? '$label must be $minLength characters'
          : '$label must be at least $minLength characters';
    }
    if (value.length > maxLength) return '$label can be at most $maxLength characters';
    if (pattern.isNotEmpty) {
      try {
        if (!RegExp(pattern).hasMatch(value)) return 'Enter a valid ${label.toLowerCase()}';
      } catch (_) {
        // An invalid admin pattern must never block the customer.
      }
    }
    return null;
  }
}

class _UpperCaseFormatter extends TextInputFormatter {
  const _UpperCaseFormatter();

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) =>
      newValue.copyWith(text: newValue.text.toUpperCase());
}

/// An operator (Mobile / DTH) or a BBPS biller (Credit Card / Electricity /
/// FASTag).
class ServiceProviderItem {
  const ServiceProviderItem({
    required this.id,
    required this.service,
    required this.name,
    this.state = '',
    this.fields = const [],
    this.supportsFetch = false,
  });

  factory ServiceProviderItem.fromJson(Map<String, dynamic> json) => ServiceProviderItem(
        id: _text(json['id']),
        service: _text(json['service']),
        name: _text(json['name']).isEmpty ? 'Provider' : _text(json['name']),
        state: _text(json['state']),
        fields: _maps(json['fields']).map(ServiceField.fromJson).toList(),
        supportsFetch: _bool(json['supportsFetch']),
      );

  final String id;
  final String service;
  final String name;
  final String state;
  final List<ServiceField> fields;
  final bool supportsFetch;

  /// Two-letter monogram for the provider avatar.
  String get initials {
    final words = name
        .replaceAll(RegExp(r'[^A-Za-z0-9 ]'), ' ')
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .toList();
    if (words.isEmpty) return 'KP';
    if (words.length == 1) {
      final word = words.first;
      return (word.length >= 2 ? word.substring(0, 2) : word).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }
}

/// One of the five services.
class BillServiceItem {
  const BillServiceItem({
    required this.key,
    required this.title,
    this.subtitle = '',
    this.kind = 'recharge',
    this.providerLabel = 'Operator',
    this.minAmount = 1,
    this.maxAmount = 100000,
    this.wholeRupees = true,
    this.supportsPlans = false,
    this.supportsOperatorDetect = false,
    this.available = true,
    this.unavailableReason,
    this.defaultFields = const [],
    this.providers = const [],
  });

  factory BillServiceItem.fromJson(Map<String, dynamic> json) => BillServiceItem(
        key: _text(json['key']),
        title: _text(json['title']),
        subtitle: _text(json['subtitle']),
        kind: _text(json['kind']).isEmpty ? 'recharge' : _text(json['kind']),
        providerLabel: _text(json['providerLabel']).isEmpty ? 'Operator' : _text(json['providerLabel']),
        minAmount: _double(json['minAmount']) > 0 ? _double(json['minAmount']) : 1,
        maxAmount: _double(json['maxAmount']) > 0 ? _double(json['maxAmount']) : 100000,
        wholeRupees: _bool(json['wholeRupees'], true),
        supportsPlans: _bool(json['supportsPlans']),
        supportsOperatorDetect: _bool(json['supportsOperatorDetect']),
        available: _bool(json['available'], true),
        unavailableReason: _text(json['unavailableReason']).isEmpty ? null : _text(json['unavailableReason']),
        defaultFields: _maps(json['defaultFields']).map(ServiceField.fromJson).toList(),
        providers: _maps(json['providers']).map(ServiceProviderItem.fromJson).where((p) => p.id.isNotEmpty).toList(),
      );

  final String key;
  final String title;
  final String subtitle;
  final String kind;
  final String providerLabel;
  final double minAmount;
  final double maxAmount;
  final bool wholeRupees;
  final bool supportsPlans;
  final bool supportsOperatorDetect;
  final bool available;
  final String? unavailableReason;
  final List<ServiceField> defaultFields;
  final List<ServiceProviderItem> providers;

  bool get isRecharge => kind == 'recharge';
  bool get isBill => kind == 'bill';

  /// Account field for a recharge provider (falls back to the service default).
  ServiceField accountFieldFor(ServiceProviderItem? provider) {
    final fields = provider?.fields ?? const <ServiceField>[];
    for (final field in fields) {
      if (field.key == 'mobile') return field;
    }
    for (final field in defaultFields) {
      if (field.key == 'mobile') return field;
    }
    return const ServiceField(key: 'mobile', label: 'Account number');
  }

  /// Validates an amount for this service (and optionally a fetched bill's
  /// rule). Returns an error message or null.
  String? validateAmount(double? amount, {AmountRule? rule}) {
    if (amount == null || amount <= 0) return 'Enter an amount';
    if (wholeRupees && amount != amount.roundToDouble()) return 'Enter amount in whole rupees';
    final min = rule == null ? minAmount : (rule.min > minAmount ? rule.min : minAmount);
    final max = rule == null ? maxAmount : (rule.max < maxAmount ? rule.max : maxAmount);
    if (rule != null && !rule.editable && (amount - rule.min).abs() > 0.009) {
      return 'This biller accepts only the exact bill amount';
    }
    if (amount < min) return 'Minimum amount is ₹${_plain(min)}';
    if (amount > max) return 'Maximum amount is ₹${_plain(max)}';
    return null;
  }
}

String _plain(double value) =>
    value == value.roundToDouble() ? value.toStringAsFixed(0) : value.toStringAsFixed(2);

class ServiceCatalog {
  const ServiceCatalog(this.services);

  factory ServiceCatalog.fromJson(Map<String, dynamic> json) => ServiceCatalog(
        _maps(json['services']).map(BillServiceItem.fromJson).where((s) => s.key.isNotEmpty).toList(),
      );

  final List<BillServiceItem> services;

  BillServiceItem? byKey(String key) {
    for (final service in services) {
      if (service.key == key) return service;
    }
    return null;
  }
}

/// How much may be paid against a fetched bill (from the biller's exactness).
class AmountRule {
  const AmountRule({
    this.mode = 'ANY',
    this.editable = true,
    this.min = 1,
    this.max = 100000,
    this.suggested,
  });

  factory AmountRule.fromJson(Map<String, dynamic> json) => AmountRule(
        mode: _text(json['mode']).isEmpty ? 'ANY' : _text(json['mode']),
        editable: _bool(json['editable'], true),
        min: _double(json['min']),
        max: _double(json['max']) > 0 ? _double(json['max']) : 100000,
        suggested: json['suggested'] == null ? null : _double(json['suggested']),
      );

  final String mode;
  final bool editable;
  final double min;
  final double max;
  final double? suggested;
}

/// A bill fetched and stored by the server. [fetchId] is what payment uses.
class FetchedBill {
  const FetchedBill({
    required this.fetchId,
    required this.service,
    required this.providerId,
    required this.providerName,
    required this.accountRef,
    required this.rule,
    this.customerName = '',
    this.amount = 0,
    this.dueDate = '',
    this.billDate = '',
    this.billNumber = '',
    this.billPeriod = '',
    this.billerName = '',
    this.billerBalance = '',
    this.remarks = '',
    this.expiresAt,
  });

  factory FetchedBill.fromJson(Map<String, dynamic> json) {
    final bill = _map(json['bill']);
    return FetchedBill(
      fetchId: _text(json['fetchId']),
      service: _text(json['service']),
      providerId: _text(json['providerId']),
      providerName: _text(json['providerName']),
      accountRef: _text(json['accountRef']),
      rule: AmountRule.fromJson(_map(json['amountRule'])),
      customerName: _text(bill['customerName']),
      amount: _double(bill['amount']),
      dueDate: _text(bill['dueDate']),
      billDate: _text(bill['billDate']),
      billNumber: _text(bill['billNumber']),
      billPeriod: _text(bill['billPeriod']),
      billerName: _text(bill['billerName']),
      billerBalance: _text(bill['billerBalance']),
      remarks: _text(bill['remarks']),
      expiresAt: _date(json['expiresAt']),
    );
  }

  final String fetchId;
  final String service;
  final String providerId;
  final String providerName;
  final String accountRef;
  final AmountRule rule;
  final String customerName;
  final double amount;
  final String dueDate;
  final String billDate;
  final String billNumber;
  final String billPeriod;
  final String billerName;
  final String billerBalance;
  final String remarks;
  final DateTime? expiresAt;

  DateTime? get due => dueDate.isEmpty ? null : DateTime.tryParse(dueDate);

  bool get isExpired => expiresAt != null && DateTime.now().isAfter(expiresAt!);
}

class MobileOperatorMatch {
  const MobileOperatorMatch({
    required this.providerId,
    required this.providerName,
    this.circle = '',
    this.stateId = '',
  });

  factory MobileOperatorMatch.fromJson(Map<String, dynamic> json) => MobileOperatorMatch(
        providerId: _text(json['providerId']),
        providerName: _text(json['providerName']),
        circle: _text(json['circle']),
        stateId: _text(json['stateId']),
      );

  final String providerId;
  final String providerName;
  final String circle;
  final String stateId;
}

class RechargePlan {
  const RechargePlan({
    required this.type,
    required this.amount,
    this.detail = '',
    this.validity = '',
    this.talktime = '',
    this.data = '',
  });

  factory RechargePlan.fromJson(Map<String, dynamic> json) => RechargePlan(
        type: _text(json['type']).isEmpty ? 'OTHER' : _text(json['type']),
        amount: _double(json['amount']),
        detail: _text(json['detail']),
        validity: _text(json['validity']),
        talktime: _text(json['talktime']),
        data: _text(json['data']),
      );

  final String type;
  final double amount;
  final String detail;
  final String validity;
  final String talktime;
  final String data;
}

class RechargePlans {
  const RechargePlans({this.categories = const [], this.plans = const []});

  factory RechargePlans.fromJson(Map<String, dynamic> json) => RechargePlans(
        categories: (json['categories'] is List ? json['categories'] as List : const [])
            .map(_text)
            .where((c) => c.isNotEmpty)
            .toList(),
        plans: _maps(json['plans']).map(RechargePlan.fromJson).where((p) => p.amount > 0).toList(),
      );

  final List<String> categories;
  final List<RechargePlan> plans;
}

/// A recharge or bill payment being processed at the operator.
class ServiceTransaction {
  const ServiceTransaction({
    required this.urid,
    required this.status,
    this.type = '',
    this.service = '',
    this.amount = 0,
    this.providerName = '',
    this.accountRef = '',
    this.orderId = '',
    this.operatorTxnId = '',
    this.message = '',
    this.paymentId,
    this.refund,
    this.createdAt,
    this.completedAt,
  });

  factory ServiceTransaction.fromJson(Map<String, dynamic> json) {
    final refund = _map(json['refund']);
    return ServiceTransaction(
      urid: _text(json['urid']),
      status: _text(json['status']).isEmpty ? 'processing' : _text(json['status']).toLowerCase(),
      type: _text(json['type']),
      service: _text(json['service']),
      amount: _double(json['amount']),
      providerName: _text(json['providerName']),
      accountRef: _text(json['accountRef']),
      orderId: _text(json['orderId']),
      operatorTxnId: _text(json['operatorTxnId']),
      message: _text(json['message']),
      paymentId: _text(json['paymentId']).isEmpty ? null : _text(json['paymentId']),
      refund: refund.isEmpty ? null : refund,
      createdAt: _date(json['createdAt']),
      completedAt: _date(json['completedAt']),
    );
  }

  final String urid;
  final String status;
  final String type;
  final String service;
  final double amount;
  final String providerName;
  final String accountRef;
  final String orderId;
  final String operatorTxnId;
  final String message;
  final String? paymentId;
  final Map<String, dynamic>? refund;
  final DateTime? createdAt;
  final DateTime? completedAt;

  bool get isSuccess => status == 'completed';
  bool get isFailed => status == 'failed' || status == 'cancelled';
  bool get isPending => !isSuccess && !isFailed;

  String get refundStatus => _text(refund?['status']);

  /// Customer-facing refund line, or null when there is no refund.
  String? get refundLabel {
    switch (refundStatus) {
      case 'WALLET_CREDITED':
        return 'Refunded to your Khatu Pay wallet';
      case 'RAZORPAY_REFUNDED':
        return 'Refund initiated to your original payment method (5-7 working days)';
      case 'REVIEW_REQUIRED':
      case 'PROCESSING':
        return 'Refund is being processed';
      default:
        return null;
    }
  }
}
