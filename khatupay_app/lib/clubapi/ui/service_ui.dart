import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../routes/app_router.dart';
import '../../services/payment_service.dart';
import '../../ui/widgets/kp_widgets.dart';
import '../models/service_catalog.dart';
import '../services/clubapi_service_updated.dart';

/// Shared building blocks for the five recharge & bill services.

/* ------------------------------------------------------------------ meta */

class ServiceMeta {
  const ServiceMeta({
    required this.key,
    required this.label,
    required this.icon,
    required this.assetPath,
    required this.color,
    required this.route,
  });

  final String key;
  final String label;
  final IconData icon;
  final String assetPath;
  final Color color;
  final String route;

  static const mobile = ServiceMeta(
    key: 'mobile',
    label: 'Mobile Recharge',
    icon: Icons.smartphone_rounded,
    assetPath: 'assets/services/mobile_recharge.png',
    color: KhatuColors.teal,
    route: '/recharge?type=mobile',
  );
  static const dth = ServiceMeta(
    key: 'dth',
    label: 'DTH Recharge',
    icon: Icons.satellite_alt_rounded,
    assetPath: 'assets/services/dth_recharge.png',
    color: KhatuColors.info,
    route: '/recharge?type=dth',
  );
  static const creditCard = ServiceMeta(
    key: 'credit_card',
    label: 'Credit Card Bill',
    icon: Icons.credit_card_rounded,
    assetPath: 'assets/services/credit_card_bill.png',
    color: KhatuColors.gold,
    route: '/bill?type=credit_card',
  );
  static const electricity = ServiceMeta(
    key: 'electricity',
    label: 'Electricity Bill',
    icon: Icons.bolt_rounded,
    assetPath: 'assets/services/electricity_bill.png',
    color: KhatuColors.saffron,
    route: '/bill?type=electricity',
  );
  static const fastag = ServiceMeta(
    key: 'fastag',
    label: 'FASTag Recharge',
    icon: Icons.toll_rounded,
    assetPath: 'assets/services/fastag_recharge.png',
    color: KhatuColors.deepTeal,
    route: '/bill?type=fastag',
  );

  static const all = [mobile, dth, creditCard, electricity, fastag];
  static const recharges = [mobile, dth];
  static const bills = [creditCard, electricity, fastag];

  static ServiceMeta of(String? key) {
    for (final meta in all) {
      if (meta.key == key) return meta;
    }
    return mobile;
  }

  /// Accepts older route values (`ELECTRICITY`, `CREDIT_CARD`, `FASTAG`).
  static String normalizeKey(String? raw, {required String fallback}) {
    final key = (raw ?? '').trim().toLowerCase();
    for (final meta in all) {
      if (meta.key == key) return key;
    }
    return fallback;
  }
}

/// Consistent generated artwork for every recharge/bill surface. The fallback
/// keeps the UI usable if an old build is missing a newly-added asset.
class ServiceIcon extends StatelessWidget {
  const ServiceIcon({
    super.key,
    required this.meta,
    this.size = 44,
    this.padding = 4,
  });

  final ServiceMeta meta;
  final double size;
  final double padding;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: Padding(
        padding: EdgeInsets.all(padding),
        child: Image.asset(
          meta.assetPath,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.medium,
          errorBuilder: (_, __, ___) =>
              Icon(meta.icon, color: meta.color, size: size * 0.56),
        ),
      ),
    );
  }
}

/// Indian-format rupees; paise only when present.
String serviceMoney(num? value) {
  final amount = (value ?? 0).toDouble();
  final hasPaise = (amount - amount.truncateToDouble()).abs() > 0.004;
  return kpMoney(amount, decimals: hasPaise ? 2 : 0);
}

/* --------------------------------------------------------------- widgets */

class ProviderAvatar extends StatelessWidget {
  const ProviderAvatar(
      {super.key, required this.provider, required this.color, this.size = 42});

  final ServiceProviderItem? provider;
  final Color color;
  final double size;

  String? _operatorAsset(String name) {
    final normalized = name.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    if (normalized.contains('airteldth') ||
        normalized.contains('airteldigitaltv')) {
      return 'assets/operators/airtel_dth.png';
    }
    if (normalized.contains('tataplay') || normalized.contains('tatasky')) {
      return 'assets/operators/tata_play.png';
    }
    if (normalized.contains('dishtv') || normalized == 'dishdth') {
      return 'assets/operators/dish_tv.png';
    }
    if (normalized.contains('sundirect') || normalized == 'sundth') {
      return 'assets/operators/sun_direct.png';
    }
    if (normalized.contains('videocon') || normalized.contains('d2h')) {
      return 'assets/operators/videocon_d2h.png';
    }
    if (normalized.contains('airtel')) return 'assets/operators/airtel.png';
    if (normalized.contains('reliancejio') || normalized == 'jio') {
      return 'assets/operators/jio.png';
    }
    if (normalized.contains('vodafone') ||
        normalized.contains('idea') ||
        normalized == 'vi') {
      return 'assets/operators/vi.png';
    }
    if (normalized.contains('bsnl')) return 'assets/operators/bsnl.png';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final asset = provider == null ? null : _operatorAsset(provider!.name);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: provider == null
          ? Icon(Icons.apps_rounded, color: color, size: size * 0.5)
          : asset != null
              ? Padding(
                  padding: EdgeInsets.all(size * 0.08),
                  child: Image.asset(
                    asset,
                    width: size,
                    height: size,
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.medium,
                    errorBuilder: (_, __, ___) => _ProviderInitials(
                      provider: provider!,
                      color: color,
                      size: size,
                    ),
                  ),
                )
              : _ProviderInitials(
                  provider: provider!,
                  color: color,
                  size: size,
                ),
    );
  }
}

class _ProviderInitials extends StatelessWidget {
  const _ProviderInitials({
    required this.provider,
    required this.color,
    required this.size,
  });

  final ServiceProviderItem provider;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => Text(
        provider.initials,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w900,
          fontSize: size * 0.32,
        ),
      );
}

/// Tappable "select operator / biller" row.
class ProviderSelectorTile extends StatelessWidget {
  const ProviderSelectorTile({
    super.key,
    required this.label,
    required this.provider,
    required this.color,
    required this.onTap,
    this.caption,
    this.error,
  });

  final String label;
  final ServiceProviderItem? provider;
  final Color color;
  final VoidCallback onTap;
  final String? caption;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final hasError = (error ?? '').isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(KhatuRadius.md),
          child: InkWell(
            borderRadius: BorderRadius.circular(KhatuRadius.md),
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.all(KhatuSpace.md),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(KhatuRadius.md),
                border: Border.all(
                    color: hasError ? KhatuColors.danger : KhatuColors.line),
              ),
              child: Row(
                children: [
                  ProviderAvatar(provider: provider, color: color),
                  KhatuSpace.wMd,
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label, style: KhatuText.caption),
                        const SizedBox(height: 2),
                        Text(
                          provider?.name ?? 'Select ${label.toLowerCase()}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: provider == null
                                ? KhatuColors.faint
                                : KhatuColors.text,
                          ),
                        ),
                        if ((caption ?? '').isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(caption!,
                              style: KhatuText.caption
                                  .copyWith(color: KhatuColors.deepTeal)),
                        ],
                      ],
                    ),
                  ),
                  Text(
                    provider == null ? 'Select' : 'Change',
                    style: const TextStyle(
                        color: KhatuColors.deepTeal,
                        fontWeight: FontWeight.w900),
                  ),
                  const Icon(Icons.chevron_right_rounded,
                      color: KhatuColors.deepTeal),
                ],
              ),
            ),
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(left: 12, top: 6),
            child: Text(error!,
                style: const TextStyle(
                    color: KhatuColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)),
          ),
      ],
    );
  }
}

/// Searchable bottom-sheet picker for operators / billers.
Future<ServiceProviderItem?> showProviderPicker(
  BuildContext context, {
  required String title,
  required List<ServiceProviderItem> providers,
  required Color color,
  String? selectedId,
}) {
  return showModalBottomSheet<ServiceProviderItem>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => _ProviderPickerSheet(
      title: title,
      providers: providers,
      color: color,
      selectedId: selectedId,
    ),
  );
}

class _ProviderPickerSheet extends StatefulWidget {
  const _ProviderPickerSheet({
    required this.title,
    required this.providers,
    required this.color,
    this.selectedId,
  });

  final String title;
  final List<ServiceProviderItem> providers;
  final Color color;
  final String? selectedId;

  @override
  State<_ProviderPickerSheet> createState() => _ProviderPickerSheetState();
}

class _ProviderPickerSheetState extends State<_ProviderPickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final rows = query.isEmpty
        ? widget.providers
        : widget.providers
            .where((p) =>
                p.name.toLowerCase().contains(query) ||
                p.state.toLowerCase().contains(query))
            .toList();

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: widget.providers.length > 6 ? 0.85 : 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (context, controller) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                KhatuSpace.lg, 0, KhatuSpace.lg, KhatuSpace.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(widget.title, style: KhatuText.h2),
                if (widget.providers.length > 6) ...[
                  KhatuSpace.gapMd,
                  TextField(
                    autofocus: false,
                    onChanged: (value) => setState(() => _query = value),
                    decoration: const InputDecoration(
                      hintText: 'Search by name or state',
                      prefixIcon: Icon(Icons.search_rounded),
                      isDense: true,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: rows.isEmpty
                ? const KpEmptyState(
                    compact: true,
                    icon: Icons.search_off_rounded,
                    title: 'No match found',
                    message: 'Try a different name.',
                  )
                : ListView.separated(
                    controller: controller,
                    padding:
                        const EdgeInsets.symmetric(vertical: KhatuSpace.sm),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1, indent: 72),
                    itemBuilder: (context, index) {
                      final provider = rows[index];
                      final selected = provider.id == widget.selectedId;
                      return ListTile(
                        onTap: () => Navigator.of(context).pop(provider),
                        leading: ProviderAvatar(
                            provider: provider, color: widget.color, size: 40),
                        title: Text(
                          provider.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 14.5),
                        ),
                        subtitle: provider.state.isEmpty
                            ? null
                            : Text(provider.state, style: KhatuText.caption),
                        trailing: selected
                            ? const Icon(Icons.check_circle_rounded,
                                color: KhatuColors.teal)
                            : const Icon(Icons.chevron_right_rounded,
                                color: KhatuColors.faint),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

enum ServicePayMethod { gateway, wallet }

/// UPI / card vs Khatu wallet choice, BharatPe style.
class PaymentMethodSelector extends StatelessWidget {
  const PaymentMethodSelector({
    super.key,
    required this.method,
    required this.walletBalance,
    required this.amount,
    required this.onChanged,
  });

  final ServicePayMethod method;
  final num? walletBalance;
  final double? amount;
  final ValueChanged<ServicePayMethod> onChanged;

  @override
  Widget build(BuildContext context) {
    final balance = (walletBalance ?? 0).toDouble();
    final walletUsable = amount != null && amount! > 0 && balance >= amount!;

    Widget option({
      required ServicePayMethod value,
      required IconData icon,
      required String title,
      required String subtitle,
      bool enabled = true,
    }) {
      final selected = method == value;
      return Opacity(
        opacity: enabled ? 1 : 0.5,
        child: InkWell(
          borderRadius: BorderRadius.circular(KhatuRadius.md),
          onTap: enabled ? () => onChanged(value) : null,
          child: Container(
            padding: const EdgeInsets.all(KhatuSpace.md),
            decoration: BoxDecoration(
              color: selected ? KhatuColors.softTeal : Colors.white,
              borderRadius: BorderRadius.circular(KhatuRadius.md),
              border: Border.all(
                  color: selected ? KhatuColors.teal : KhatuColors.line,
                  width: selected ? 1.4 : 1),
            ),
            child: Row(
              children: [
                Icon(icon,
                    color: selected ? KhatuColors.deepTeal : KhatuColors.muted),
                KhatuSpace.wMd,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 14)),
                      const SizedBox(height: 2),
                      Text(subtitle, style: KhatuText.caption),
                    ],
                  ),
                ),
                Icon(
                  selected
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded,
                  color: selected ? KhatuColors.teal : KhatuColors.lineStrong,
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        option(
          value: ServicePayMethod.gateway,
          icon: Icons.account_balance_rounded,
          title: 'UPI, Card or Net Banking',
          subtitle: 'Google Pay, PhonePe, Paytm, any bank',
        ),
        KhatuSpace.gapSm,
        option(
          value: ServicePayMethod.wallet,
          icon: Icons.account_balance_wallet_rounded,
          title: 'Khatu Pay wallet',
          subtitle: walletUsable || amount == null || amount == 0
              ? 'Balance ${serviceMoney(balance)}'
              : 'Balance ${serviceMoney(balance)} - not enough for this payment',
          enabled: walletUsable,
        ),
      ],
    );
  }
}

class SecurePaymentNote extends StatelessWidget {
  const SecurePaymentNote({super.key, this.bbps = false});

  final bool bbps;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.lock_rounded, size: 14, color: KhatuColors.muted),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            bbps
                ? '100% secure · Bharat BillPay (BBPS) · Instant confirmation'
                : '100% secure payment · Automatic refund if recharge fails',
            textAlign: TextAlign.center,
            style: KhatuText.caption,
          ),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------ payment run */

/// Arguments for the status screen.
class ServiceStatusArgs {
  const ServiceStatusArgs({
    required this.serviceKey,
    this.transaction,
    this.pendingOrderId,
    this.amount,
    this.providerName,
    this.accountRef,
  });

  final String serviceKey;
  final ServiceTransaction? transaction;
  final String? pendingOrderId;
  final double? amount;
  final String? providerName;
  final String? accountRef;
}

/// Result of [runServicePayment] when the flow did not reach the status page.
class ServicePaymentFeedback {
  const ServicePaymentFeedback(this.message,
      {this.neutral = false, this.fieldErrors = const {}, this.code = ''});

  final String message;
  final bool neutral;
  final Map<String, String> fieldErrors;
  final String code;
}

/// Pays for a recharge / bill and opens the live status screen.
///
/// Returns null when the customer was taken to the status screen, or feedback
/// to show on the form (cancelled, validation error, gateway failure).
Future<ServicePaymentFeedback?> runServicePayment({
  required PaymentService payments,
  required Map<String, dynamic> service,
  required ServicePayMethod method,
  required String description,
  required ServiceStatusArgs Function(
          ServiceTransaction? transaction, String? pendingOrderId)
      statusArgs,
  String? contact,
}) async {
  try {
    ServiceTransaction? transaction;
    String? pendingOrderId;

    if (method == ServicePayMethod.wallet) {
      final data = await payments.payServiceWithWallet(service);
      transaction = _transactionFrom(data);
    } else {
      final order = await payments.createServiceOrder(service);
      try {
        final verified = await payments.openGatewayCheckout(order,
            description: description, contact: contact);
        transaction = _transactionFrom(verified);
        if (transaction == null) {
          pendingOrderId = (order['orderId'] ?? '').toString();
        }
      } on PaymentVerificationPendingException catch (pending) {
        pendingOrderId = pending.orderId;
      }
    }

    final args = statusArgs(transaction, pendingOrderId);
    final query = <String, String>{
      'service': args.serviceKey,
      if (transaction != null && transaction.urid.isNotEmpty)
        'urid': transaction.urid,
      if ((pendingOrderId ?? '').isNotEmpty) 'order': pendingOrderId!,
    };
    router.go(Uri(path: '/service-status', queryParameters: query).toString(),
        extra: args);
    return null;
  } on PaymentCancelledException {
    return const ServicePaymentFeedback(
        'Payment cancelled. No money was deducted.',
        neutral: true);
  } on PaymentFailedException catch (error) {
    return ServicePaymentFeedback(error.message);
  } on ServiceApiException catch (error) {
    return ServicePaymentFeedback(error.message,
        fieldErrors: error.fieldErrors, code: error.code);
  } catch (error) {
    final code = _errorCode(error);
    return ServicePaymentFeedback(
      friendlyErrorMessage(error,
          fallback: 'Payment could not be started. Please try again.'),
      code: code,
    );
  }
}

ServiceTransaction? _transactionFrom(Map<String, dynamic> data) {
  final raw = data['service'];
  if (raw is! Map) return null;
  final transaction =
      ServiceTransaction.fromJson(Map<String, dynamic>.from(raw));
  return transaction.urid.isEmpty ? null : transaction;
}

String _errorCode(Object error) {
  if (error is DioException) {
    final body = error.response?.data;
    if (body is Map) return body['code']?.toString() ?? '';
  }
  return '';
}
