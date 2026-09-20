import 'package:flutter/material.dart';
import '../../routes/app_router.dart';
import '../../services/offer_service.dart';

/// Fetches and renders offers/banners for a given placement (e.g.
/// `HOME_BANNER`, `LOAN_APPLY`) as a swipeable carousel with dot indicators.
/// Uses local branded banners when the backend has no active offer.
class OfferBannerCarousel extends StatefulWidget {
  final String placement;
  final int limit;
  final double height;

  const OfferBannerCarousel({
    super.key,
    required this.placement,
    this.limit = 8,
    this.height = 150,
  });

  @override
  State<OfferBannerCarousel> createState() => _OfferBannerCarouselState();
}

class _OfferBannerCarouselState extends State<OfferBannerCarousel> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = OfferService().getOffers(placement: widget.placement, limit: widget.limit);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snapshot) {
        final remoteOffers = snapshot.data ?? [];
        final offers = remoteOffers.isNotEmpty ? remoteOffers : _localOffersForPlacement(widget.placement);
        if (offers.isEmpty) return const SizedBox.shrink();
        return _OfferBanners(offers: offers, height: widget.height);
      },
    );
  }

  List<Map<String, dynamic>> _localOffersForPlacement(String placement) {
    switch (placement) {
      case 'HOME_BANNER':
        return [
          {
            'assetImage': 'assets/banners/welcome_banner.png',
            'title': 'Welcome to Khatu Pay',
            'subtitle': 'Fast wallet, UPI and bill payments in one secure app',
            'route': '/',
          },
        ];
      case 'LOAN_APPLY':
        return [
          {
            'assetImage': 'assets/banners/loan_banner.png',
            'title': 'Apply for Khatu Pay Credit',
            'subtitle': 'Submit documents and track your loan professionally',
            'route': '/apply',
          },
        ];
      case 'KYC_BANNER':
        return [
          {
            'assetImage': 'assets/banners/kyc_banner.png',
            'title': 'Complete KYC Verification',
            'subtitle': 'Unlock trusted account features after approval',
            'route': '/kyc',
          },
        ];
      case 'QR_UPI_BANNER':
        return [
          {
            'assetImage': 'assets/banners/qr_upi_banner.png',
            'title': 'Accept UPI Payments',
            'subtitle': 'Share your Khatu Pay QR and receive payments instantly',
            'route': '/qr',
          },
        ];
      default:
        return const [];
    }
  }
}

class _OfferBanners extends StatefulWidget {
  final List<Map<String, dynamic>> offers;
  final double height;

  const _OfferBanners({required this.offers, required this.height});

  @override
  State<_OfferBanners> createState() => _OfferBannersState();
}

class _OfferBannersState extends State<_OfferBanners> {
  final _controller = PageController(viewportFraction: 0.94);
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: widget.height,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.offers.length,
            onPageChanged: (value) => setState(() => _index = value),
            itemBuilder: (context, index) {
              final offer = widget.offers[index];
              final image = (offer['imageUrl'] ?? offer['thumbnailUrl'] ?? '').toString();
              final assetImage = (offer['assetImage'] ?? '').toString();
              final route = (offer['route'] ?? '').toString();
              final offerId = (offer['_id'] ?? '').toString();
              return Padding(
                padding: const EdgeInsets.only(right: 10),
                child: InkWell(
                  borderRadius: BorderRadius.circular(18),
                  onTap: () {
                    if (route.isNotEmpty) {
                      router.go(route);
                    } else if (offerId.isNotEmpty) {
                      router.go('/offers/$offerId');
                    }
                  },
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (assetImage.isNotEmpty)
                          Image.asset(
                            assetImage,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(color: const Color(0xFF0F766E)),
                          )
                        else if (image.isNotEmpty)
                          Image.network(
                            image,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(color: const Color(0xFF0F766E)),
                          )
                        else
                          Container(color: const Color(0xFF0F766E)),
                        Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.centerLeft,
                              end: Alignment.centerRight,
                              colors: [Colors.black.withOpacity(0.72), Colors.black.withOpacity(0.12)],
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if ((offer['discountText'] ?? '').toString().isNotEmpty)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(999)),
                                  child: Text(offer['discountText'].toString(), style: const TextStyle(color: Color(0xFF92400E), fontSize: 11, fontWeight: FontWeight.w900)),
                                ),
                              const SizedBox(height: 8),
                              Text(
                                offer['title']?.toString() ?? 'Offer',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w900),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                offer['subtitle']?.toString() ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        if (widget.offers.length > 1) ...[
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.offers.length, (index) {
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: _index == index ? 18 : 7,
                height: 7,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  color: _index == index ? const Color(0xFF0F766E) : const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(99),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }
}
