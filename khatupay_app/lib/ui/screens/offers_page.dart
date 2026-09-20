import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../routes/app_router.dart';
import '../../services/offer_service.dart';
import '../widgets/kp_widgets.dart';

/// Offers & rewards.
///
/// Saffron is the reward accent in the design system, so this screen leans on
/// it while keeping the same card/section grammar as the rest of the app.
/// Every offer field is optional in the API, so each read is null-guarded.
class OffersPage extends StatefulWidget {
  const OffersPage({super.key});

  @override
  State<OffersPage> createState() => _OffersPageState();
}

class _OffersPageState extends State<OffersPage> {
  String _category = 'ALL';
  bool _loading = true;
  List<Map<String, dynamic>> _offers = [];
  String? _error;

  static const _categories = [
    'ALL',
    'GENERAL',
    'LOAN',
    'QR',
    'BILL',
    'WALLET',
    'SHOPPING',
    'REFERRAL',
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final offers = await OfferService()
          .getOffers(placement: 'OFFERS_PAGE', category: _category);
      if (!mounted) return;
      setState(() => _offers = offers);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _offers = [];
        _error = friendlyErrorMessage(e, fallback: 'Unable to load offers.');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return KpAppShell(
      title: 'Offers & Rewards',
      onRefresh: _load,
      children: [
        const _RewardsHero(),
        KhatuSpace.gapLg,
        SizedBox(
          height: 38,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _categories.length,
            separatorBuilder: (_, __) => KhatuSpace.wSm,
            itemBuilder: (_, index) {
              final category = _categories[index];
              final selected = category == _category;
              return ChoiceChip(
                selected: selected,
                showCheckmark: false,
                label: Text(
                  category == 'ALL'
                      ? 'All offers'
                      : KpStatusBadge.prettify(category),
                ),
                labelStyle: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 12.5,
                  color:
                      selected ? KhatuColors.deepTeal : KhatuColors.muted,
                ),
                onSelected: (_) {
                  if (selected) return;
                  setState(() => _category = category);
                  _load();
                },
              );
            },
          ),
        ),
        KhatuSpace.gapLg,
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 56),
            child: Center(
              child: CircularProgressIndicator(color: KhatuColors.teal),
            ),
          )
        else if (_error != null)
          KpErrorState(
            title: 'Offers unavailable',
            message: _error!,
            onRetry: _load,
            compact: true,
          )
        else if (_offers.isEmpty)
          KpEmptyState(
            icon: Icons.local_offer_outlined,
            title: 'No live offers right now',
            message:
                'New cashback and reward campaigns land here regularly. Check back soon.',
            actionLabel: 'Explore rewards',
            onAction: () => router.go('/rewards'),
          )
        else
          for (final offer in _offers) ...[
            _OfferCard(offer: offer),
            KhatuSpace.gapMd,
          ],
      ],
    );
  }
}

class _RewardsHero extends StatelessWidget {
  const _RewardsHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KhatuSpace.lg),
      decoration: BoxDecoration(
        gradient: KhatuColors.saffronGradient,
        borderRadius: BorderRadius.circular(KhatuRadius.lg),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(KhatuRadius.md),
            ),
            child: const Icon(Icons.card_giftcard_rounded,
                color: Colors.white, size: 26),
          ),
          KhatuSpace.wMd,
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Earn on every payment',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 3),
                Text(
                  'Cashback on recharges, bills and QR payments. Credited straight to your Khatu wallet.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    height: 1.3,
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

class OfferDetailPage extends StatefulWidget {
  const OfferDetailPage({super.key, required this.id});

  final String id;

  @override
  State<OfferDetailPage> createState() => _OfferDetailPageState();
}

class _OfferDetailPageState extends State<OfferDetailPage> {
  Map<String, dynamic>? _offer;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final offer = await OfferService().getOffer(widget.id);
      if (!mounted) return;
      setState(() => _offer = offer);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error =
          friendlyErrorMessage(e, fallback: 'Unable to load this offer.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openAction(Map<String, dynamic> offer) async {
    final deepLink = (offer['deepLink'] ?? '').toString().trim();
    if (deepLink.startsWith('/')) {
      router.go(deepLink);
      return;
    }

    final ctaUrl = (offer['ctaUrl'] ?? '').toString().trim();
    if (ctaUrl.isEmpty) return;
    final uri = Uri.tryParse(ctaUrl);
    if (uri == null) return;

    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open this offer link.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final offer = _offer;

    if (_loading) {
      return const KpAppShell(
        title: 'Offer Details',
        scrollable: false,
        body: Center(child: CircularProgressIndicator(color: KhatuColors.teal)),
      );
    }

    if (_error != null) {
      return KpAppShell(
        title: 'Offer Details',
        scrollable: false,
        body: KpErrorState(message: _error!, onRetry: _load),
      );
    }

    if (offer == null) {
      return const KpAppShell(
        title: 'Offer Details',
        scrollable: false,
        body: KpEmptyState(
          icon: Icons.local_offer_outlined,
          title: 'Offer not found',
          message: 'This offer may have expired or been withdrawn.',
        ),
      );
    }

    final terms = offer['terms'];
    final termsList = terms is List ? terms : const [];
    final ctaText = (offer['ctaText'] ?? '').toString().trim();
    final hasAction = (offer['deepLink'] ?? '').toString().trim().isNotEmpty ||
        (offer['ctaUrl'] ?? '').toString().trim().isNotEmpty;

    return KpAppShell(
      title: 'Offer Details',
      onRefresh: _load,
      children: [
        KpNetworkImage(
          source: (offer['imageUrl'] ?? offer['thumbnailUrl'] ?? '').toString(),
          height: 200,
          width: double.infinity,
          fallbackAsset: 'assets/banners/welcome_banner.png',
          fallbackIcon: Icons.local_offer_rounded,
          borderRadius: BorderRadius.circular(KhatuRadius.lg),
        ),
        KhatuSpace.gapLg,
        Text(
          (offer['title'] ?? 'Offer').toString(),
          style: KhatuText.h1,
        ),
        if ((offer['subtitle'] ?? '').toString().trim().isNotEmpty) ...[
          KhatuSpace.gapSm,
          Text(offer['subtitle'].toString(), style: KhatuText.bodyMuted),
        ],
        if ((offer['discountText'] ?? '').toString().trim().isNotEmpty) ...[
          KhatuSpace.gapMd,
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: KhatuColors.softSaffron,
                borderRadius: BorderRadius.circular(KhatuRadius.pill),
                border: Border.all(
                    color: KhatuColors.saffron.withValues(alpha: 0.35)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.local_offer_rounded,
                      size: 14, color: KhatuColors.gold),
                  const SizedBox(width: 6),
                  Text(
                    offer['discountText'].toString(),
                    style: const TextStyle(
                      color: KhatuColors.gold,
                      fontWeight: FontWeight.w900,
                      fontSize: 12.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
        if ((offer['couponCode'] ?? '').toString().trim().isNotEmpty) ...[
          KhatuSpace.gapMd,
          _CouponBox(code: offer['couponCode'].toString().trim()),
        ],
        if ((offer['description'] ?? '').toString().trim().isNotEmpty) ...[
          KhatuSpace.gapLg,
          KpCard(
            child: Text(
              offer['description'].toString(),
              style: KhatuText.body.copyWith(height: 1.5),
            ),
          ),
        ],
        if (termsList.isNotEmpty) ...[
          const KpSectionHeader(title: 'Terms & conditions'),
          KpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final term in termsList)
                  Padding(
                    padding: const EdgeInsets.only(bottom: KhatuSpace.sm),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 5, right: 8),
                          child: Icon(Icons.circle,
                              size: 5, color: KhatuColors.muted),
                        ),
                        Expanded(
                          child: Text(term.toString(),
                              style: KhatuText.bodyMuted),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
        if (hasAction) ...[
          KhatuSpace.gapXl,
          ElevatedButton.icon(
            onPressed: () => _openAction(offer),
            icon: const Icon(Icons.arrow_forward_rounded, size: 18),
            label: Text(ctaText.isEmpty ? 'Use this offer' : ctaText),
          ),
        ],
      ],
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.offer});

  final Map<String, dynamic> offer;

  @override
  Widget build(BuildContext context) {
    final id = (offer['_id'] ?? offer['id'] ?? '').toString();
    final discount = (offer['discountText'] ?? '').toString().trim();

    return Material(
      color: KhatuColors.surface,
      borderRadius: BorderRadius.circular(KhatuRadius.lg),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: id.isEmpty ? null : () => router.go('/offers/$id'),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(KhatuRadius.lg),
            border: Border.all(color: KhatuColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  KpNetworkImage(
                    source: (offer['imageUrl'] ??
                            offer['thumbnailUrl'] ??
                            '')
                        .toString(),
                    height: 150,
                    width: double.infinity,
                    fallbackAsset: 'assets/banners/welcome_banner.png',
                    fallbackIcon: Icons.local_offer_rounded,
                    borderRadius: BorderRadius.zero,
                  ),
                  if (discount.isNotEmpty)
                    Positioned(
                      top: KhatuSpace.md,
                      left: KhatuSpace.md,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: KhatuColors.saffron,
                          borderRadius:
                              BorderRadius.circular(KhatuRadius.pill),
                        ),
                        child: Text(
                          discount,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.all(KhatuSpace.lg - 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (offer['title'] ?? 'Offer').toString(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: KhatuText.h3,
                    ),
                    if ((offer['subtitle'] ?? '')
                        .toString()
                        .trim()
                        .isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        offer['subtitle'].toString(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: KhatuText.caption,
                      ),
                    ],
                    KhatuSpace.gapMd,
                    Row(
                      children: [
                        if ((offer['category'] ?? '')
                            .toString()
                            .trim()
                            .isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: KhatuColors.softTeal,
                              borderRadius:
                                  BorderRadius.circular(KhatuRadius.pill),
                            ),
                            child: Text(
                              KpStatusBadge.prettify(
                                  offer['category'].toString()),
                              style: const TextStyle(
                                color: KhatuColors.deepTeal,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        const Spacer(),
                        const Text(
                          'View offer',
                          style: TextStyle(
                            color: KhatuColors.deepTeal,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded,
                            size: 18, color: KhatuColors.deepTeal),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CouponBox extends StatelessWidget {
  const _CouponBox({required this.code});

  final String code;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KhatuSpace.lg - 2),
      decoration: BoxDecoration(
        color: KhatuColors.softSaffron,
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        border: Border.all(color: const Color(0xFFFCD34D)),
      ),
      child: Row(
        children: [
          const Icon(Icons.confirmation_number_rounded,
              color: KhatuColors.saffron),
          KhatuSpace.wMd,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('COUPON CODE', style: KhatuText.caption),
                const SizedBox(height: 2),
                Text(
                  code,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                    color: KhatuColors.text,
                  ),
                ),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: code));
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Coupon code copied')),
              );
            },
            icon: const Icon(Icons.copy_rounded, size: 16),
            label: const Text('Copy'),
            style: TextButton.styleFrom(foregroundColor: KhatuColors.gold),
          ),
        ],
      ),
    );
  }
}
