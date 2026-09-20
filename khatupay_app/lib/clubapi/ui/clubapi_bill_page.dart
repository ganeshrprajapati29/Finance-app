import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_theme.dart';
import '../../providers/auth_providers.dart';
import '../../routes/app_router.dart';
import '../../services/payment_service.dart';
import '../../ui/widgets/app_back_button.dart';
import '../../ui/widgets/kp_widgets.dart';
import '../models/service_catalog.dart';
import '../providers/clubapi_providers.dart';
import '../services/clubapi_service_updated.dart';
import 'service_ui.dart';

/// Credit card, electricity and FASTag bills via BBPS.
///
/// Select biller -> enter the details that biller asks for -> Fetch bill ->
/// review customer name, amount and due date -> pay. The fetched bill is
/// stored on the server and payment refers to it by id, so the amount rules
/// the biller sets (exact / up to bill / any) are enforced server-side too.
class ClubAPIBillPage extends ConsumerStatefulWidget {
  const ClubAPIBillPage({super.key, this.initialType});

  /// `credit_card`, `electricity` or `fastag` (older uppercase values work).
  final String? initialType;

  @override
  ConsumerState<ClubAPIBillPage> createState() => _ClubAPIBillPageState();
}

class _ClubAPIBillPageState extends ConsumerState<ClubAPIBillPage> {
  final _payments = PaymentService();
  final _amountController = TextEditingController();
  final Map<String, TextEditingController> _fieldControllers = {};

  late String _serviceKey;
  ServiceCatalog? _catalog;
  Object? _catalogError;
  bool _loadingCatalog = true;

  ServiceProviderItem? _provider;
  FetchedBill? _bill;
  bool _fetching = false;
  bool _paying = false;
  ServicePayMethod _method = ServicePayMethod.gateway;

  String? _providerError;
  Map<String, String> _fieldErrors = {};
  String? _amountError;
  String? _notice;
  bool _noticeNeutral = false;

  @override
  void initState() {
    super.initState();
    _serviceKey =
        ServiceMeta.normalizeKey(widget.initialType, fallback: 'electricity');
    if (!ServiceMeta.bills.any((meta) => meta.key == _serviceKey))
      _serviceKey = 'electricity';
    _amountController.addListener(() {
      if (_amountError != null) setState(() => _amountError = null);
      final amount = _amount;
      if (_method == ServicePayMethod.wallet) {
        final balance =
            (ref.read(meProvider).valueOrNull?.walletBalance ?? 0).toDouble();
        if (amount == null || amount > balance)
          setState(() => _method = ServicePayMethod.gateway);
      }
    });
    _loadCatalog();
  }

  @override
  void dispose() {
    for (final controller in _fieldControllers.values) {
      controller.dispose();
    }
    _amountController.dispose();
    _payments.dispose();
    super.dispose();
  }

  ServiceMeta get _meta => ServiceMeta.of(_serviceKey);
  BillServiceItem? get _service => _catalog?.byKey(_serviceKey);
  double? get _amount => double.tryParse(_amountController.text.trim());

  List<ServiceField> _fieldsFor(ServiceProviderItem? provider) {
    final fields = provider?.fields ?? const <ServiceField>[];
    if (fields.any((field) => field.key == 'mobile')) return fields;
    return _service?.defaultFields ?? const [];
  }

  TextEditingController _controllerFor(String key) {
    return _fieldControllers.putIfAbsent(key, () {
      final controller = TextEditingController();
      var lastText = '';
      controller.addListener(() {
        // Controllers also notify on cursor / selection moves; only a real
        // text change should invalidate anything.
        if (controller.text == lastText) return;
        lastText = controller.text;

        // Changing any detail invalidates a bill fetched for the old details.
        if (_bill != null) {
          _amountController.clear();
          setState(() => _bill = null);
        }
        if (_fieldErrors.containsKey(key)) {
          setState(() => _fieldErrors = Map.of(_fieldErrors)..remove(key));
        }
      });
      return controller;
    });
  }

  Future<void> _loadCatalog({bool refresh = false}) async {
    setState(() {
      _loadingCatalog = true;
      _catalogError = null;
    });
    try {
      final catalog = await ref
          .read(clubAPIServiceProvider)
          .getServiceCatalog(refresh: refresh);
      if (!mounted) return;
      setState(() {
        _catalog = catalog;
        _loadingCatalog = false;
        final providers = catalog.byKey(_serviceKey)?.providers ?? const [];
        if (_provider != null && !providers.any((p) => p.id == _provider!.id)) {
          _provider = null;
          _bill = null;
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _catalogError = error;
        _loadingCatalog = false;
      });
    }
  }

  void _resetForm() {
    for (final controller in _fieldControllers.values) {
      controller.dispose();
    }
    _fieldControllers.clear();
    _amountController.clear();
    _bill = null;
    _providerError = null;
    _fieldErrors = {};
    _amountError = null;
    _notice = null;
  }

  void _switchService(String key) {
    if (key == _serviceKey || _paying || _fetching) return;
    setState(() {
      _serviceKey = key;
      _provider = null;
      _resetForm();
    });
  }

  Future<void> _pickProvider() async {
    final service = _service;
    if (service == null) return;
    FocusScope.of(context).unfocus();
    final picked = await showProviderPicker(
      context,
      title: 'Select ${service.providerLabel.toLowerCase()}',
      providers: service.providers,
      color: _meta.color,
      selectedId: _provider?.id,
    );
    if (picked == null || !mounted || picked.id == _provider?.id) return;
    setState(() {
      _provider = picked;
      _resetForm();
    });
  }

  Map<String, String>? _validatedFields() {
    final errors = <String, String>{};
    final values = <String, String>{};
    for (final field in _fieldsFor(_provider)) {
      final raw = _controllerFor(field.key).text;
      final error = field.validate(raw);
      if (error != null) {
        errors[field.key] = error;
      } else {
        values[field.key] = field.normalize(raw);
      }
    }
    setState(() {
      _providerError = _provider == null
          ? 'Select the ${_service?.providerLabel.toLowerCase() ?? 'biller'}'
          : null;
      _fieldErrors = errors;
    });
    if (_provider == null || errors.isNotEmpty) return null;
    return values;
  }

  Future<void> _fetchBill() async {
    final service = _service;
    if (service == null || _fetching) return;
    FocusScope.of(context).unfocus();
    setState(() => _notice = null);
    final values = _validatedFields();
    if (values == null) return;

    setState(() => _fetching = true);
    try {
      final bill = await ref.read(clubAPIServiceProvider).fetchServiceBill(
            service: service.key,
            providerId: _provider!.id,
            fields: values,
            customerMobile: ref.read(meProvider).valueOrNull?.mobile,
          );
      if (!mounted) return;
      final suggested =
          bill.rule.suggested ?? (bill.amount > 0 ? bill.amount : null);
      _amountController.text =
          suggested == null ? '' : _plainAmount(suggested, service.wholeRupees);
      setState(() => _bill = bill);
    } on ServiceApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _notice = error.message;
        _noticeNeutral = false;
        if (error.fieldErrors.isNotEmpty) _fieldErrors = error.fieldErrors;
        if (error.code == 'PROVIDER_UNAVAILABLE') {
          _provider = null;
          _loadCatalog(refresh: true);
        }
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _notice = 'Bill could not be fetched. Please try again.';
          _noticeNeutral = false;
        });
      }
    } finally {
      if (mounted) setState(() => _fetching = false);
    }
  }

  String _plainAmount(double value, bool wholeRupees) {
    if (wholeRupees) return value.ceil().toString();
    return value == value.roundToDouble()
        ? value.toStringAsFixed(0)
        : value.toStringAsFixed(2);
  }

  Future<void> _pay() async {
    final service = _service;
    final provider = _provider;
    if (service == null || provider == null || _paying) return;
    FocusScope.of(context).unfocus();
    setState(() => _notice = null);

    final bill = _bill;
    Map<String, String>? values;
    if (provider.supportsFetch) {
      if (bill == null) {
        await _fetchBill();
        return;
      }
      if (bill.isExpired) {
        setState(() {
          _bill = null;
          _notice =
              'This bill was fetched a while ago. Please fetch it again before paying.';
          _noticeNeutral = true;
        });
        return;
      }
    } else {
      values = _validatedFields();
      if (values == null) return;
    }

    final amount = _amount;
    final amountError = service.validateAmount(amount, rule: bill?.rule);
    if (amountError != null) {
      setState(() => _amountError = amountError);
      return;
    }

    final user = ref.read(meProvider).valueOrNull;
    setState(() => _paying = true);

    final feedback = await runServicePayment(
      payments: _payments,
      method: _method,
      description: '${service.title} · ${provider.name}',
      contact: user?.mobile,
      service: {
        'key': service.key,
        'providerId': provider.id,
        'amount': amount,
        if (bill != null) 'fetchId': bill.fetchId,
        if (values != null) 'fields': values,
      },
      statusArgs: (transaction, pendingOrderId) => ServiceStatusArgs(
        serviceKey: service.key,
        transaction: transaction,
        pendingOrderId: pendingOrderId,
        amount: amount,
        providerName: provider.name,
        accountRef: bill?.accountRef ?? values?['mobile'],
      ),
    );

    if (!mounted) return;
    if (_method == ServicePayMethod.wallet) ref.invalidate(meProvider);
    setState(() {
      _paying = false;
      if (feedback == null) return;
      _notice = feedback.message;
      _noticeNeutral = feedback.neutral;
      if (feedback.fieldErrors.isNotEmpty) _fieldErrors = feedback.fieldErrors;
      if (const [
        'BILL_FETCH_EXPIRED',
        'BILL_FETCH_INVALID',
        'BILL_FETCH_REQUIRED'
      ].contains(feedback.code)) {
        _bill = null;
      }
      if (feedback.code == 'PROVIDER_UNAVAILABLE') {
        _provider = null;
        _bill = null;
        _loadCatalog(refresh: true);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final walletBalance = ref.watch(meProvider).valueOrNull?.walletBalance;

    return KpAppShell(
      title: 'Pay bills',
      showBack: false,
      appBar: AppBar(
        leading: const AppBackButton(fallbackRoute: '/bills'),
        title: Text(_meta.label),
        actions: [
          IconButton(
            tooltip: 'Payment history',
            onPressed: () => router.go('/service-history'),
            icon: const Icon(Icons.receipt_long_rounded),
          ),
        ],
      ),
      onRefresh: () => _loadCatalog(refresh: true),
      children: [
        _BillServiceChips(selected: _serviceKey, onSelected: _switchService),
        KhatuSpace.gapLg,
        ..._body(walletBalance),
      ],
    );
  }

  List<Widget> _body(num? walletBalance) {
    if (_loadingCatalog && _catalog == null) {
      return const [
        SizedBox(height: 120),
        Center(child: CircularProgressIndicator())
      ];
    }
    if (_catalogError != null && _catalog == null) {
      return [
        KpErrorState.fromError(
          _catalogError!,
          title: 'Bill payments are unavailable right now',
          onRetry: () => _loadCatalog(refresh: true),
        ),
      ];
    }

    final service = _service;
    if (service == null || !service.available) {
      return [
        KpEmptyState(
          icon: _meta.icon,
          title: '${_meta.label} is temporarily unavailable',
          message: service?.unavailableReason ??
              'Please try again in a little while.',
        ),
      ];
    }
    if (service.providers.isEmpty) {
      return [
        KpEmptyState(
          icon: _meta.icon,
          title: 'Billers are being added',
          message: '${_meta.label} will be available here very soon.',
        ),
      ];
    }

    final provider = _provider;
    final bill = _bill;
    final fields = _fieldsFor(provider);
    final needsFetch = provider?.supportsFetch ?? true;
    final showAmount = provider != null && (!needsFetch || bill != null);
    final amount = _amount;

    return [
      ProviderSelectorTile(
        label: service.providerLabel,
        provider: provider,
        color: _meta.color,
        caption: provider?.state,
        error: _providerError,
        onTap: _pickProvider,
      ),
      if (provider != null) ...[
        KhatuSpace.gapMd,
        KpCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < fields.length; i++) ...[
                if (i > 0) KhatuSpace.gapMd,
                _BillFieldInput(
                  field: fields[i],
                  controller: _controllerFor(fields[i].key),
                  error: _fieldErrors[fields[i].key],
                  enabled: !_fetching && !_paying,
                  isLast: i == fields.length - 1,
                  onSubmitted: needsFetch ? _fetchBill : null,
                ),
              ],
              if (needsFetch && bill == null) ...[
                KhatuSpace.gapLg,
                SizedBox(
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: _fetching ? null : _fetchBill,
                    icon: _fetching
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2.2, color: Colors.white),
                          )
                        : const Icon(Icons.receipt_long_rounded),
                    label: Text(_fetching ? 'Fetching bill...' : 'Fetch bill'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
      if (bill != null) ...[
        KhatuSpace.gapMd,
        _BillDetailsCard(
          bill: bill,
          provider: provider!,
          meta: _meta,
          onEdit: _paying
              ? null
              : () {
                  _amountController.clear();
                  setState(() => _bill = null);
                },
        ),
      ],
      if (_notice != null) ...[
        KhatuSpace.gapMd,
        _noticeNeutral
            ? KpNoticeBanner(
                message: _notice!, icon: Icons.info_outline_rounded)
            : KpErrorBanner(message: _notice!),
      ],
      if (showAmount) ...[
        KhatuSpace.gapMd,
        KpCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Amount to pay', style: KhatuText.h3),
              KhatuSpace.gapSm,
              TextField(
                controller: _amountController,
                enabled: !_paying && (bill?.rule.editable ?? true),
                keyboardType: TextInputType.numberWithOptions(
                    decimal: !service.wholeRupees),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(
                    service.wholeRupees
                        ? RegExp(r'[0-9]')
                        : RegExp(r'^\d{0,6}(\.\d{0,2})?'),
                  ),
                  LengthLimitingTextInputFormatter(9),
                ],
                style:
                    const TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
                decoration: InputDecoration(
                  prefixText: '₹ ',
                  prefixStyle: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: KhatuColors.text),
                  hintText: '0',
                  errorText: _amountError,
                  helperText: _amountHelper(service, bill),
                  helperMaxLines: 2,
                ),
              ),
              if (bill != null && bill.rule.editable && bill.amount > 0) ...[
                KhatuSpace.gapSm,
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      label: Text('Full bill ${serviceMoney(bill.amount)}'),
                      selected:
                          amount != null && (amount - bill.amount).abs() < 0.01,
                      onSelected: _paying
                          ? null
                          : (_) => _amountController.text =
                              _plainAmount(bill.amount, service.wholeRupees),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        KhatuSpace.gapMd,
        KpCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Pay using', style: KhatuText.h3),
              KhatuSpace.gapSm,
              PaymentMethodSelector(
                method: _method,
                walletBalance: walletBalance,
                amount: amount,
                onChanged: (value) => setState(() => _method = value),
              ),
            ],
          ),
        ),
        KhatuSpace.gapLg,
        SizedBox(
          height: 54,
          child: ElevatedButton(
            onPressed: _paying ? null : _pay,
            child: _paying
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.4, color: Colors.white),
                  )
                : Text(amount != null && amount > 0
                    ? 'Pay ${serviceMoney(amount)}'
                    : 'Proceed to pay'),
          ),
        ),
      ],
      KhatuSpace.gapMd,
      const SecurePaymentNote(bbps: true),
    ];
  }

  String _amountHelper(BillServiceItem service, FetchedBill? bill) {
    final rule = bill?.rule;
    if (rule == null) {
      return 'Min ${serviceMoney(service.minAmount)} · Max ${serviceMoney(service.maxAmount)}';
    }
    if (!rule.editable) return 'This biller accepts the exact bill amount only';
    final min = rule.min > service.minAmount ? rule.min : service.minAmount;
    final max = rule.max < service.maxAmount ? rule.max : service.maxAmount;
    switch (rule.mode) {
      case 'EXACT_DOWN':
        return 'You can pay part of the bill, up to ${serviceMoney(max)}';
      case 'EXACT_UP':
        return 'Pay at least ${serviceMoney(min)}';
      default:
        return 'Pay between ${serviceMoney(min)} and ${serviceMoney(max)}';
    }
  }
}

/* ---------------------------------------------------------------- widgets */

class _BillServiceChips extends StatelessWidget {
  const _BillServiceChips({required this.selected, required this.onSelected});

  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final meta in ServiceMeta.bills)
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(
                  right: meta == ServiceMeta.bills.last ? 0 : 8),
              child: Material(
                color: meta.key == selected
                    ? meta.color.withValues(alpha: 0.12)
                    : Colors.white,
                borderRadius: BorderRadius.circular(KhatuRadius.md),
                child: InkWell(
                  borderRadius: BorderRadius.circular(KhatuRadius.md),
                  onTap: () => onSelected(meta.key),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(KhatuRadius.md),
                      border: Border.all(
                        color: meta.key == selected
                            ? meta.color
                            : KhatuColors.line,
                        width: meta.key == selected ? 1.4 : 1,
                      ),
                    ),
                    child: Column(
                      children: [
                        ServiceIcon(meta: meta, size: 34, padding: 1),
                        const SizedBox(height: 4),
                        Text(
                          switch (meta.key) {
                            'credit_card' => 'Credit Card',
                            'electricity' => 'Electricity',
                            _ => 'FASTag',
                          },
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                            color: meta.key == selected
                                ? KhatuColors.text
                                : KhatuColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _BillFieldInput extends StatelessWidget {
  const _BillFieldInput({
    required this.field,
    required this.controller,
    required this.error,
    required this.enabled,
    required this.isLast,
    this.onSubmitted,
  });

  final ServiceField field;
  final TextEditingController controller;
  final String? error;
  final bool enabled;
  final bool isLast;
  final VoidCallback? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      enabled: enabled,
      keyboardType: field.keyboardType,
      inputFormatters: field.formatters,
      textCapitalization: field.uppercase
          ? TextCapitalization.characters
          : TextCapitalization.none,
      autocorrect: false,
      enableSuggestions: false,
      textInputAction: isLast ? TextInputAction.done : TextInputAction.next,
      onSubmitted: isLast && onSubmitted != null ? (_) => onSubmitted!() : null,
      style: const TextStyle(
          fontSize: 16, fontWeight: FontWeight.w800, letterSpacing: 0.3),
      decoration: InputDecoration(
        labelText: field.label,
        hintText: field.placeholder.isEmpty ? null : field.placeholder,
        helperText: field.hint.isEmpty ? null : field.hint,
        helperMaxLines: 2,
        errorText: error,
        prefixIcon: Icon(field.inputType == 'mobile'
            ? Icons.phone_android_rounded
            : Icons.badge_outlined),
      ),
    );
  }
}

class _BillDetailsCard extends StatelessWidget {
  const _BillDetailsCard({
    required this.bill,
    required this.provider,
    required this.meta,
    required this.onEdit,
  });

  final FetchedBill bill;
  final ServiceProviderItem provider;
  final ServiceMeta meta;
  final VoidCallback? onEdit;

  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];

  String _date(String raw) {
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    return '${parsed.day} ${_months[parsed.month - 1]} ${parsed.year}';
  }

  @override
  Widget build(BuildContext context) {
    final due = bill.due;
    final today = DateTime.now();
    final daysLeft = due == null
        ? null
        : DateTime(due.year, due.month, due.day)
            .difference(DateTime(today.year, today.month, today.day))
            .inDays;

    String? dueBadge;
    Color dueColor = KhatuColors.muted;
    if (daysLeft != null) {
      if (daysLeft < 0) {
        dueBadge = 'Overdue';
        dueColor = KhatuColors.danger;
      } else if (daysLeft == 0) {
        dueBadge = 'Due today';
        dueColor = KhatuColors.warning;
      } else if (daysLeft <= 5) {
        dueBadge = 'Due in $daysLeft day${daysLeft == 1 ? '' : 's'}';
        dueColor = KhatuColors.warning;
      }
    }

    final rows = <MapEntry<String, String>>[
      if (bill.customerName.isNotEmpty)
        MapEntry('Customer name', bill.customerName),
      MapEntry(bill.service == 'fastag' ? 'Vehicle number' : 'Account',
          bill.accountRef),
      if (bill.dueDate.isNotEmpty) MapEntry('Due date', _date(bill.dueDate)),
      if (bill.billDate.isNotEmpty) MapEntry('Bill date', _date(bill.billDate)),
      if (bill.billNumber.isNotEmpty) MapEntry('Bill number', bill.billNumber),
      if (bill.billPeriod.isNotEmpty)
        MapEntry('Bill period', KpStatusBadge.prettify(bill.billPeriod)),
      if (bill.billerBalance.isNotEmpty)
        MapEntry('Current balance', '₹${bill.billerBalance}'),
    ];

    return KpCard(
      borderColor: meta.color.withValues(alpha: 0.35),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              ProviderAvatar(provider: provider, color: meta.color, size: 38),
              KhatuSpace.wMd,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      bill.billerName.isNotEmpty
                          ? bill.billerName
                          : provider.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w900, fontSize: 14.5),
                    ),
                    const SizedBox(height: 3),
                    const KpStatusBadge(
                        status: 'VERIFIED', label: 'Bill fetched', dense: true),
                  ],
                ),
              ),
              if (onEdit != null)
                TextButton(onPressed: onEdit, child: const Text('Edit')),
            ],
          ),
          const Divider(height: 24),
          Text(bill.amount > 0 ? 'Bill amount' : 'Amount due',
              style: KhatuText.label),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  bill.amount > 0
                      ? serviceMoney(bill.amount)
                      : 'Enter amount below',
                  style: bill.amount > 0 ? KhatuText.display : KhatuText.h3,
                ),
              ),
              if (dueBadge != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: dueColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(KhatuRadius.pill),
                  ),
                  child: Text(dueBadge,
                      style: TextStyle(
                          color: dueColor,
                          fontWeight: FontWeight.w900,
                          fontSize: 12)),
                ),
            ],
          ),
          KhatuSpace.gapMd,
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                      width: 118, child: Text(row.key, style: KhatuText.label)),
                  Expanded(
                    child: Text(
                      row.value,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 13.5),
                    ),
                  ),
                ],
              ),
            ),
          if (bill.remarks.isNotEmpty) ...[
            KhatuSpace.gapSm,
            KpNoticeBanner(
                message: bill.remarks, icon: Icons.info_outline_rounded),
          ],
        ],
      ),
    );
  }
}
