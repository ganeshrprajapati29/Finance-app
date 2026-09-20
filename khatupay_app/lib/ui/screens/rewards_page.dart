import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../services/reward_service.dart';
import '../widgets/app_back_button.dart';

class RewardsPage extends StatefulWidget {
  const RewardsPage({super.key});

  @override
  State<RewardsPage> createState() => _RewardsPageState();
}

class _RewardsPageState extends State<RewardsPage> {
  final _service = RewardService();
  final _types = const [
    'ALL',
    'CASHBACK',
    'SCRATCH',
    'COUPON',
    'PUZZLE',
    'POINTS',
    'OFFER'
  ];
  String _type = 'ALL';
  bool _loading = true;
  List<Map<String, dynamic>> _items = [];
  String? _message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final items = await _service.campaigns(type: _type);
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) {
        setState(() => _message =
            friendlyErrorMessage(e, fallback: 'Unable to load rewards.'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _claim(Map<String, dynamic> item) async {
    final type = item['type']?.toString() ?? 'OFFER';
    String? coupon;
    int? answerIndex;

    if (type == 'COUPON' && (item['couponCode'] ?? '').toString().isNotEmpty) {
      coupon = await _askText('Coupon Code', 'Enter coupon code');
      if (coupon == null) return;
    }
    if (type == 'PUZZLE') {
      answerIndex = await _askPuzzle(item);
      if (answerIndex == null) return;
    }

    try {
      final result = await _service.claim(
          (item['_id'] ?? item['id']).toString(),
          couponCode: coupon,
          answerIndex: answerIndex);
      final claim = Map<String, dynamic>.from(result['claim'] ?? {});
      final cashback = claim['cashbackAmount'] ?? 0;
      setState(() => _message = cashback > 0
          ? 'Rs. $cashback cashback has been added to your wallet.'
          : 'Reward claimed successfully.');
      await _load();
    } catch (e) {
      if (mounted) setState(() => _message = e.toString());
    }
  }

  Future<String?> _askText(String title, String hint) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
            controller: controller,
            decoration: InputDecoration(hintText: hint)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, controller.text.trim()),
              child: const Text('Apply')),
        ],
      ),
    );
  }

  Future<int?> _askPuzzle(Map<String, dynamic> item) {
    final puzzle = Map<String, dynamic>.from(item['puzzle'] ?? {});
    final options = (puzzle['options'] as List? ?? [])
        .map((e) => e.toString())
        .where((e) => e.isNotEmpty)
        .toList();
    return showDialog<int>(
      context: context,
      builder: (context) => SimpleDialog(
        title: Text(
            (puzzle['question'] ?? 'Choose the correct answer').toString()),
        children: [
          for (var i = 0; i < options.length; i++)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, i),
              child: Text(options[i],
                  style: const TextStyle(fontWeight: FontWeight.w800)),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text('Rewards & Cashback'),
          leading: const AppBackButton()),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            const _Hero(),
            const SizedBox(height: 14),
            SizedBox(
              height: 42,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _types.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, index) {
                  final type = _types[index];
                  return ChoiceChip(
                    selected: type == _type,
                    label: Text(type),
                    onSelected: (_) {
                      setState(() => _type = type);
                      _load();
                    },
                  );
                },
              ),
            ),
            if (_message != null) ...[
              const SizedBox(height: 12),
              _Message(text: _message!),
            ],
            const SizedBox(height: 14),
            if (_loading)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(40),
                      child: CircularProgressIndicator()))
            else if (_items.isEmpty)
              const Card(
                  child: Padding(
                      padding: EdgeInsets.all(22),
                      child: Text('You have no active rewards yet.',
                          style: TextStyle(fontWeight: FontWeight.w800))))
            else
              ..._items.map((item) =>
                  _RewardCard(item: item, onClaim: () => _claim(item))),
          ],
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
            colors: [KhatuColors.deepTeal, KhatuColors.teal]),
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Row(
        children: [
          Icon(Icons.redeem, color: Colors.white, size: 46),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Win cashback daily',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900)),
                Text(
                    'Scratch cards, coupons, puzzle rewards and wallet cashback.',
                    style: TextStyle(
                        color: Colors.white70, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RewardCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onClaim;

  const _RewardCard({required this.item, required this.onClaim});

  @override
  Widget build(BuildContext context) {
    final image = (item['imageUrl'] ?? '').toString();
    final claimed = item['myClaim'] != null;
    final type = (item['type'] ?? 'OFFER').toString();
    return Card(
      clipBehavior: Clip.antiAlias,
      margin: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (image.isNotEmpty)
            Image.network(image,
                height: 150,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const _FallbackImage())
          else
            const _FallbackImage(),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Chip(label: Text(type)),
                    const Spacer(),
                    if ((item['couponCode'] ?? '').toString().isNotEmpty)
                      Text(item['couponCode'].toString(),
                          style: const TextStyle(fontWeight: FontWeight.w900)),
                  ],
                ),
                Text(item['title']?.toString() ?? 'Reward',
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text(item['subtitle']?.toString() ?? '',
                    style: const TextStyle(
                        color: KhatuColors.muted, fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: claimed ? null : onClaim,
                    icon: Icon(claimed
                        ? Icons.check_circle
                        : type == 'SCRATCH'
                            ? Icons.auto_awesome
                            : Icons.redeem),
                    label: Text(claimed
                        ? 'Claimed'
                        : type == 'SCRATCH'
                            ? 'Scratch & Win'
                            : 'Claim Reward'),
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

class _FallbackImage extends StatelessWidget {
  const _FallbackImage();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 150,
      width: double.infinity,
      color: KhatuColors.deepTeal,
      child: const Center(
          child: Icon(Icons.local_activity, color: Colors.white, size: 54)),
    );
  }
}

class _Message extends StatelessWidget {
  final String text;
  const _Message({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: text.toLowerCase().contains('add') ||
                text.toLowerCase().contains('claim')
            ? Colors.green.shade50
            : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(text, style: const TextStyle(fontWeight: FontWeight.w800)),
    );
  }
}
