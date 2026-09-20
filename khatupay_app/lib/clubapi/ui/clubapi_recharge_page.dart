import 'dart:async';

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

/// Mobile & DTH recharge.
///
/// Mobile: type the number -> operator is suggested from the number series
/// -> pick a plan or amount -> pay. DTH: pick the operator -> subscriber ID ->
/// amount -> pay. Everything the server needs is sent as ids; the server
/// re-validates operator, number and amount before any money moves.
class ClubAPIRechargePage extends ConsumerStatefulWidget {
  const ClubAPIRechargePage({super.key, this.initialType});

  /// `mobile` or `dth`.
  final String? initialType;

  @override
  ConsumerState<ClubAPIRechargePage> createState() =>
      _ClubAPIRechargePageState();
}

class _ClubAPIRechargePageState extends ConsumerState<ClubAPIRechargePage> {
  final _accountController = TextEditingController();
  final _amountController = TextEditingController();
  final _payments = PaymentService();

  late String _serviceKey;
  ServiceCatalog? _catalog;
  Object? _catalogError;
  bool _loadingCatalog = true;

  ServiceProviderItem? _provider;
  MobileOperatorMatch? _detected;
  bool _detecting = false;
  String _lastDetectedNumber = '';
  Timer? _detectDebounce;

  RechargePlan? _selectedPlan;
  ServicePayMethod _method = ServicePayMethod.gateway;
  bool _paying = false;

  String? _providerError;
  String? _accountError;
  String? _amountError;
  String? _notice;
  bool _noticeNeutral = false;

  @override
  void initState() {
    super.initState();
    _serviceKey =
        ServiceMeta.normalizeKey(widget.initialType, fallback: 'mobile');
    if (!ServiceMeta.recharges.any((meta) => meta.key == _serviceKey))
      _serviceKey = 'mobile';
    _accountController.addListener(_onAccountChanged);
    _amountController.addListener(_onAmountChanged);
    _loadCatalog();
  }

  @override
  void dispose() {
    _detectDebounce?.cancel();
    _accountController.dispose();
    _amountController.dispose();
    _payments.dispose();
    super.dispose();
  }

  ServiceMeta get _meta => ServiceMeta.of(_serviceKey);
  BillServiceItem? get _service => _catalog?.byKey(_serviceKey);
  bool get _isMobile => _serviceKey == 'mobile';
  double? get _amount => double.tryParse(_amountController.text.trim());

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
        // A previously selected provider may have been disabled meanwhile.
        final providers = catalog.byKey(_serviceKey)?.providers ?? const [];
        if (_provider != null && !providers.any((p) => p.id == _provider!.id))
          _provider = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _catalogError = error;
        _loadingCatalog = false;
      });
    }
  }

  void _switchService(String key) {
    if (key == _serviceKey || _paying) return;
    setState(() {
      _serviceKey = key;
      _provider = null;
      _detected = null;
      _lastDetectedNumber = '';
      _selectedPlan = null;
      _providerError = null;
      _accountError = null;
      _amountError = null;
      _notice = null;
      _accountController.clear();
      _amountController.clear();
    });
  }

  void _onAccountChanged() {
    if (_accountError != null) setState(() => _accountError = null);
    if (!_isMobile) return;

    final digits = _accountController.text.replaceAll(RegExp(r'\D'), '');
    _detectDebounce?.cancel();
    if (digits.length != 10 || digits == _lastDetectedNumber) return;
    _detectDebounce =
        Timer(const Duration(milliseconds: 250), () => _detectOperator(digits));
  }

  void _onAmountChanged() {
    final amount = _amount;
    setState(() {
      _amountError = null;
      if (_selectedPlan != null && amount != _selectedPlan!.amount)
        _selectedPlan = null;
      if (_method == ServicePayMethod.wallet) {
        final balance =
            (ref.read(meProvider).valueOrNull?.walletBalance ?? 0).toDouble();
        if (amount == null || amount > balance)
          _method = ServicePayMethod.gateway;
      }
    });
  }

  Future<void> _detectOperator(String number) async {
    setState(() => _detecting = true);
    final match =
        await ref.read(clubAPIServiceProvider).detectMobileOperator(number);
    if (!mounted) return;
    final providers = _service?.providers ?? const [];
    ServiceProviderItem? detectedProvider;
    if (match != null) {
      for (final provider in providers) {
        if (provider.id == match.providerId) detectedProvider = provider;
      }
    }
    setState(() {
      _detecting = false;
      _lastDetectedNumber = number;
      _detected = match;
      // Only auto-fill when the user has not chosen an operator themselves.
      if (detectedProvider != null &&
          (_provider == null || _provider!.id == _detected?.providerId)) {
        _provider = detectedProvider;
        _providerError = null;
      }
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
    if (picked == null || !mounted) return;
    setState(() {
      if (_provider?.id != picked.id) _selectedPlan = null;
      _provider = picked;
      _providerError = null;
    });
  }

  Future<void> _browsePlans() async {
    final provider = _provider;
    if (provider == null) {
      setState(() => _providerError = 'Select the operator to see plans');
      return;
    }
    FocusScope.of(context).unfocus();
    final plan = await showModalBottomSheet<RechargePlan>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _PlansSheet(
        provider: provider,
        stateId: _detected?.providerId == provider.id ? _detected!.stateId : '',
        circle: _detected?.providerId == provider.id ? _detected!.circle : '',
        service: ref.read(clubAPIServiceProvider),
      ),
    );
    if (plan == null || !mounted) return;
    // Set the plan first so the amount listener recognises the new amount as
    // this plan's and keeps the selection.
    _selectedPlan = plan;
    _amountController.text = plan.amount.toStringAsFixed(0);
    _amountController.selection =
        TextSelection.collapsed(offset: _amountController.text.length);
    setState(() {});
  }

  void _setQuickAmount(int value) {
    _amountController.text = '$value';
    _amountController.selection =
        TextSelection.collapsed(offset: _amountController.text.length);
  }

  bool _validate(BillServiceItem service) {
    final field = service.accountFieldFor(_provider);
    final accountError = field.validate(_accountController.text);
    final amountError = service.validateAmount(_amount);
    setState(() {
      _providerError = _provider == null
          ? 'Select the ${service.providerLabel.toLowerCase()}'
          : null;
      _accountError = accountError;
      _amountError = amountError;
    });
    return _providerError == null &&
        accountError == null &&
        amountError == null;
  }

  Future<void> _pay() async {
    final service = _service;
    if (service == null || _paying) return;
    FocusScope.of(context).unfocus();
    setState(() => _notice = null);
    if (!_validate(service)) return;

    final provider = _provider!;
    final field = service.accountFieldFor(provider);
    final account = field.normalize(_accountController.text);
    final amount = _amount!;
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
        'accountNumber': account,
        'amount': amount,
      },
      statusArgs: (transaction, pendingOrderId) => ServiceStatusArgs(
        serviceKey: service.key,
        transaction: transaction,
        pendingOrderId: pendingOrderId,
        amount: amount,
        providerName: provider.name,
        accountRef: account,
      ),
    );

    if (!mounted) return;
    if (_method == ServicePayMethod.wallet) ref.invalidate(meProvider);
    setState(() {
      _paying = false;
      if (feedback != null) {
        _notice = feedback.message;
        _noticeNeutral = feedback.neutral;
        final accountFieldError = feedback.fieldErrors['mobile'];
        if (accountFieldError != null) _accountError = accountFieldError;
        if (feedback.code == 'PROVIDER_UNAVAILABLE') {
          _provider = null;
          _loadCatalog(refresh: true);
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final walletBalance = ref.watch(meProvider).valueOrNull?.walletBalance;

    return KpAppShell(
      title: 'Recharge',
      showBack: false,
      appBar: AppBar(
        leading: const AppBackButton(fallbackRoute: '/bills'),
        title: Text(_meta.label),
        actions: [
          IconButton(
            tooltip: 'Recharge history',
            onPressed: () => router.go('/service-history'),
            icon: const Icon(Icons.receipt_long_rounded),
          ),
        ],
      ),
      onRefresh: () => _loadCatalog(refresh: true),
      children: [
        _ServiceSwitcher(
          options: ServiceMeta.recharges,
          selected: _serviceKey,
          onSelected: _switchService,
        ),
        KhatuSpace.gapLg,
        ..._body(walletBalance),
      ],
    );
  }

  List<Widget> _body(num? walletBalance) {
    if (_loadingCatalog && _catalog == null) {
      return const [
        SizedBox(height: 120),
        Center(child: CircularProgressIndicator()),
      ];
    }
    if (_catalogError != null && _catalog == null) {
      return [
        KpErrorState.fromError(
          _catalogError!,
          title: 'Recharge is unavailable right now',
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
          title: 'Operators are being set up',
          message: '${_meta.label} will be available here very soon.',
        ),
      ];
    }

    final field = service.accountFieldFor(_provider);
    final detectedCaption =
        _detected != null && _provider?.id == _detected!.providerId
            ? ['Detected', if (_detected!.circle.isNotEmpty) _detected!.circle]
                .join(' · ')
            : null;

    final accountInput = TextField(
      controller: _accountController,
      keyboardType: field.keyboardType,
      inputFormatters: field.formatters,
      autocorrect: false,
      enableSuggestions: false,
      textInputAction: TextInputAction.next,
      style: const TextStyle(
          fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: 0.4),
      decoration: InputDecoration(
        labelText: field.label,
        hintText: field.placeholder.isEmpty ? null : field.placeholder,
        helperText: field.hint.isEmpty ? null : field.hint,
        errorText: _accountError,
        prefixIcon:
            Icon(_isMobile ? Icons.phone_android_rounded : Icons.tag_rounded),
        prefixText: _isMobile ? '+91  ' : null,
        suffixIcon: _detecting
            ? const Padding(
                padding: EdgeInsets.all(14),
                child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2)),
              )
            : null,
      ),
    );

    final providerTile = ProviderSelectorTile(
      label: service.providerLabel,
      provider: _provider,
      color: _meta.color,
      caption: detectedCaption,
      error: _providerError,
      onTap: _pickProvider,
    );

    final quickAmounts = _isMobile
        ? const [199, 239, 299, 479, 719]
        : const [200, 300, 500, 1000];
    final amount = _amount;

    return [
      KpCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: _isMobile
              ? [accountInput, KhatuSpace.gapMd, providerTile]
              : [providerTile, KhatuSpace.gapMd, accountInput],
        ),
      ),
      KhatuSpace.gapMd,
      KpCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(child: Text('Amount', style: KhatuText.h3)),
                if (service.supportsPlans)
                  TextButton.icon(
                    onPressed: _paying ? null : _browsePlans,
                    icon: const Icon(Icons.list_alt_rounded, size: 18),
                    label: const Text('Browse plans'),
                  ),
              ],
            ),
            KhatuSpace.gapSm,
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
              decoration: InputDecoration(
                prefixText: '₹ ',
                prefixStyle: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: KhatuColors.text),
                hintText: '0',
                errorText: _amountError,
                helperText:
                    'Min ${serviceMoney(service.minAmount)} · Max ${serviceMoney(service.maxAmount)}',
              ),
            ),
            KhatuSpace.gapMd,
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final value in quickAmounts)
                  ChoiceChip(
                    label: Text('₹$value'),
                    selected: amount == value.toDouble(),
                    onSelected: _paying ? null : (_) => _setQuickAmount(value),
                  ),
              ],
            ),
            if (_selectedPlan != null) ...[
              KhatuSpace.gapMd,
              _SelectedPlanSummary(plan: _selectedPlan!),
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
      if (_notice != null) ...[
        KhatuSpace.gapMd,
        _noticeNeutral
            ? KpNoticeBanner(
                message: _notice!, icon: Icons.info_outline_rounded)
            : KpErrorBanner(message: _notice!),
      ],
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
                      strokeWidth: 2.4, color: Colors.white))
              : Text(amount != null && amount > 0
                  ? 'Pay ${serviceMoney(amount)}'
                  : 'Proceed to pay'),
        ),
      ),
      KhatuSpace.gapMd,
      const SecurePaymentNote(),
    ];
  }
}

/* ---------------------------------------------------------------- widgets */

class _ServiceSwitcher extends StatelessWidget {
  const _ServiceSwitcher(
      {required this.options,
      required this.selected,
      required this.onSelected});

  final List<ServiceMeta> options;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: KhatuColors.surfaceAlt,
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        border: Border.all(color: KhatuColors.line),
      ),
      child: Row(
        children: [
          for (final option in options)
            Expanded(
              child: GestureDetector(
                onTap: () => onSelected(option.key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: option.key == selected
                        ? Colors.white
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(KhatuRadius.sm),
                    boxShadow: option.key == selected ? KhatuShadow.soft : null,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ServiceIcon(meta: option, size: 24, padding: 1),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          option.key == 'mobile'
                              ? 'Mobile'
                              : option.key == 'dth'
                                  ? 'DTH'
                                  : option.label,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            color: option.key == selected
                                ? KhatuColors.text
                                : KhatuColors.muted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SelectedPlanSummary extends StatelessWidget {
  const _SelectedPlanSummary({required this.plan});

  final RechargePlan plan;

  @override
  Widget build(BuildContext context) {
    final facts = [
      if (plan.validity.isNotEmpty) 'Validity ${plan.validity}',
      if (plan.data.isNotEmpty) 'Data ${plan.data}',
      if (plan.talktime.isNotEmpty && plan.talktime != '0')
        'Talktime ₹${plan.talktime}',
    ];
    return Container(
      padding: const EdgeInsets.all(KhatuSpace.md),
      decoration: BoxDecoration(
        color: KhatuColors.softTeal,
        borderRadius: BorderRadius.circular(KhatuRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle_rounded,
                  size: 16, color: KhatuColors.deepTeal),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  facts.isEmpty ? 'Plan selected' : facts.join(' · '),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: KhatuColors.deepTeal,
                      fontSize: 12.5),
                ),
              ),
            ],
          ),
          if (plan.detail.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(plan.detail,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: KhatuText.label),
          ],
        ],
      ),
    );
  }
}

class _PlansSheet extends StatefulWidget {
  const _PlansSheet({
    required this.provider,
    required this.stateId,
    required this.circle,
    required this.service,
  });

  final ServiceProviderItem provider;
  final String stateId;
  final String circle;
  final ClubAPIService service;

  @override
  State<_PlansSheet> createState() => _PlansSheetState();
}

class _PlansSheetState extends State<_PlansSheet> {
  RechargePlans? _plans;
  Object? _error;
  String _category = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final plans = await widget.service
          .getMobilePlans(widget.provider.id, stateId: widget.stateId);
      if (!mounted) return;
      setState(() {
        _plans = plans;
        _category = plans.categories.isNotEmpty ? plans.categories.first : '';
      });
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  static String _categoryLabel(String raw) {
    switch (raw.toUpperCase()) {
      case 'FTT':
      case 'FULLTT':
        return 'Talktime';
      case 'DATA':
        return 'Data';
      case 'SPL':
      case 'SPECIAL':
        return 'Special';
      case 'TUP':
      case 'TOPUP':
        return 'Top-up';
      case 'RMG':
      case 'ROAMING':
        return 'Roaming';
      case 'COMBO':
        return 'Combo';
      default:
        return KpStatusBadge.prettify(raw);
    }
  }

  @override
  Widget build(BuildContext context) {
    final plans = _plans;
    final visible = plans == null
        ? const <RechargePlan>[]
        : plans.plans
            .where((plan) => _category.isEmpty || plan.type == _category)
            .toList();

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, controller) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                KhatuSpace.lg, 0, KhatuSpace.lg, KhatuSpace.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${widget.provider.name} plans', style: KhatuText.h2),
                if (widget.circle.isNotEmpty)
                  Text(widget.circle, style: KhatuText.caption),
              ],
            ),
          ),
          if (plans != null && plans.categories.length > 1)
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: KhatuSpace.lg),
                children: [
                  for (final category in plans.categories)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(_categoryLabel(category)),
                        selected: category == _category,
                        onSelected: (_) => setState(() => _category = category),
                      ),
                    ),
                ],
              ),
            ),
          const Divider(height: 1),
          Expanded(
            child: _error != null
                ? KpErrorState.fromError(_error!,
                    title: 'Plans unavailable', onRetry: _load, compact: true)
                : plans == null
                    ? const Center(child: CircularProgressIndicator())
                    : visible.isEmpty
                        ? const KpEmptyState(
                            compact: true,
                            icon: Icons.list_alt_rounded,
                            title: 'No plans listed',
                            message:
                                'You can still enter any amount to recharge.',
                          )
                        : ListView.separated(
                            controller: controller,
                            padding: const EdgeInsets.all(KhatuSpace.lg),
                            itemCount: visible.length,
                            separatorBuilder: (_, __) => KhatuSpace.gapSm,
                            itemBuilder: (context, index) {
                              final plan = visible[index];
                              return KpCard(
                                onTap: () => Navigator.of(context).pop(plan),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(serviceMoney(plan.amount),
                                              style: KhatuText.amount),
                                          const SizedBox(height: 6),
                                          Wrap(
                                            spacing: 12,
                                            runSpacing: 4,
                                            children: [
                                              if (plan.validity.isNotEmpty)
                                                _PlanFact(
                                                    icon: Icons
                                                        .event_available_rounded,
                                                    text: plan.validity),
                                              if (plan.data.isNotEmpty)
                                                _PlanFact(
                                                    icon: Icons
                                                        .signal_cellular_alt_rounded,
                                                    text: plan.data),
                                              if (plan.talktime.isNotEmpty &&
                                                  plan.talktime != '0')
                                                _PlanFact(
                                                    icon: Icons.call_rounded,
                                                    text: '₹${plan.talktime}'),
                                            ],
                                          ),
                                          if (plan.detail.isNotEmpty) ...[
                                            const SizedBox(height: 6),
                                            Text(plan.detail,
                                                maxLines: 3,
                                                overflow: TextOverflow.ellipsis,
                                                style: KhatuText.label),
                                          ],
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    const Icon(Icons.chevron_right_rounded,
                                        color: KhatuColors.faint),
                                  ],
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class _PlanFact extends StatelessWidget {
  const _PlanFact({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: KhatuColors.deepTeal),
        const SizedBox(width: 4),
        Text(text,
            style:
                const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800)),
      ],
    );
  }
}
