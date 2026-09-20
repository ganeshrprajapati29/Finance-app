import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/app_theme.dart';
import '../../core/fcm.dart';
import '../../core/friendly_error.dart';
import '../../routes/app_router.dart';
import '../../services/notification_service.dart';
import '../widgets/app_back_button.dart';
import '../widgets/kp_widgets.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  final _scroll = ScrollController();
  final List<Map<String, dynamic>> _items = [];
  static const _filters = [
    'All',
    'Recharge',
    'Bills',
    'Loans',
    'Business',
    'Security'
  ];
  String _filter = 'All';
  bool _unreadOnly = false;
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = false;
  int _page = 1;
  int _unread = 0;
  String? _error;
  final Set<String> _busy = {};

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    FCM.inboxRevision.addListener(_onPush);
    _load();
  }

  @override
  void dispose() {
    FCM.inboxRevision.removeListener(_onPush);
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onPush() => _load();
  void _onScroll() {
    if (_scroll.position.extentAfter < 260 && _hasMore && !_loadingMore) {
      _load(more: true);
    }
  }

  Future<void> _load({bool more = false}) async {
    if (more) {
      setState(() => _loadingMore = true);
    } else {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
      });
    }
    try {
      final page = more ? _page + 1 : 1;
      final responses = await Future.wait<dynamic>([
        NotificationService.getNotificationPage(
          page: page,
          limit: 20,
          unreadOnly: _unreadOnly,
        ),
        NotificationService.getUnreadCount(),
      ]);
      final result = Map<String, dynamic>.from(responses[0] as Map);
      final serverUnread = responses[1] as int;
      final raw = result['notifications'];
      final rows = raw is List
          ? raw
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
          : <Map<String, dynamic>>[];
      final pagination = result['pagination'] is Map
          ? Map<String, dynamic>.from(result['pagination'])
          : <String, dynamic>{};
      if (!mounted) return;
      setState(() {
        if (!more) _items.clear();
        final existing = _items.map((item) => item['_id'].toString()).toSet();
        _items.addAll(rows.where((row) => existing.add(row['_id'].toString())));
        _page = page;
        _hasMore = pagination['hasMore'] == true;
        _unread = serverUnread;
      });
    } catch (error) {
      if (mounted) {
        setState(() => _error = friendlyErrorMessage(error,
            fallback:
                'Notifications could not be refreshed. Please try again.'));
      }
    } finally {
      if (mounted)
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
    }
  }

  Future<void> _mark(Map<String, dynamic> item, bool read) async {
    final id = (item['_id'] ?? '').toString();
    if (id.isEmpty || _busy.contains(id)) return;
    setState(() => _busy.add(id));
    try {
      if (read) {
        await NotificationService.markAsRead(id);
      } else {
        await NotificationService.markAsUnread(id);
      }
      if (!mounted) return;
      setState(() {
        item['isRead'] = read;
        item['readAt'] = read ? DateTime.now().toIso8601String() : null;
        _unread = _items.where((row) => row['isRead'] != true).length;
        if (_unreadOnly && read) _items.remove(item);
      });
    } catch (error) {
      _showError(error, 'Unable to update this notification.');
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  Future<void> _markAll() async {
    if (_busy.contains('all')) return;
    setState(() => _busy.add('all'));
    try {
      await NotificationService.markAllAsRead();
      if (!mounted) return;
      setState(() {
        for (final item in _items) {
          item['isRead'] = true;
          item['readAt'] = DateTime.now().toIso8601String();
        }
        _unread = 0;
        if (_unreadOnly) _items.clear();
      });
    } catch (error) {
      _showError(error, 'Unable to mark notifications as read.');
    } finally {
      if (mounted) setState(() => _busy.remove('all'));
    }
  }

  Future<bool> _confirmDelete(Map<String, dynamic> item) async {
    final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
              title: const Text('Delete notification?'),
              content: const Text(
                  'This notification will be removed from your activity centre.'),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: const Text('Cancel')),
                FilledButton(
                    onPressed: () => Navigator.pop(context, true),
                    child: const Text('Delete')),
              ],
            ));
    if (confirmed != true) return false;
    final id = (item['_id'] ?? '').toString();
    try {
      await NotificationService.deleteNotification(id);
      if (mounted)
        setState(() {
          _items.remove(item);
          _unread = _items.where((row) => row['isRead'] != true).length;
        });
      return true;
    } catch (error) {
      _showError(error, 'Unable to delete this notification.');
      return false;
    }
  }

  void _showError(Object error, String fallback) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(friendlyErrorMessage(error, fallback: fallback))));
  }

  List<Map<String, dynamic>> get _visible => _items.where((item) {
        if (_filter == 'All') return true;
        return _category(item) == _filter;
      }).toList();

  @override
  Widget build(BuildContext context) {
    final grouped = _group(_visible);
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: const AppBackButton(fallbackRoute: '/'),
        title: Row(children: [
          const Text('Notifications'),
          if (_unread > 0) ...[
            const SizedBox(width: 8),
            Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                    color: KhatuColors.teal,
                    borderRadius: BorderRadius.circular(20)),
                child: Text('$_unread',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w900))),
          ],
        ]),
        actions: [
          if (_unread > 0)
            TextButton(
                onPressed: _busy.contains('all') ? null : _markAll,
                child: const Text('Read all')),
          IconButton(
              tooltip: 'Notification settings',
              onPressed: () => router.push('/settings'),
              icon: const Icon(Icons.settings_outlined)),
          IconButton(
              tooltip: 'Refresh',
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          controller: _scroll,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
                child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                        height: 38,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _filters.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (_, index) {
                            final value = _filters[index];
                            return ChoiceChip(
                                label: Text(value),
                                selected: _filter == value,
                                onSelected: (_) =>
                                    setState(() => _filter = value));
                          },
                        )),
                    const SizedBox(height: 10),
                    FilterChip(
                      avatar: const Icon(Icons.mark_email_unread_outlined,
                          size: 18),
                      label: const Text('Unread only'),
                      selected: _unreadOnly,
                      onSelected: (value) {
                        setState(() => _unreadOnly = value);
                        _load();
                      },
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 10),
                      KpNoticeBanner(
                          icon: Icons.sync_problem_outlined,
                          color: KhatuColors.warning,
                          message: _items.isEmpty
                              ? _error!
                              : 'You may be offline. Showing recent notifications.'),
                    ],
                    if (_loading) ...[
                      const SizedBox(height: 14),
                      ...List.generate(4, (_) => const _NotificationSkeleton()),
                    ],
                  ]),
            )),
            if (!_loading && grouped.isEmpty)
              SliverFillRemaining(
                  hasScrollBody: false,
                  child: _EmptyInbox(filtered: _items.isNotEmpty))
            else
              for (final entry in grouped.entries) ...[
                SliverToBoxAdapter(
                    child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                        child: Text(entry.key,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                color: KhatuColors.muted)))),
                SliverList(
                    delegate: SliverChildBuilderDelegate(
                  (_, index) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: _notification(entry.value[index])),
                  childCount: entry.value.length,
                )),
              ],
            if (_loadingMore)
              const SliverToBoxAdapter(
                  child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Center(child: CircularProgressIndicator()))),
            const SliverToBoxAdapter(child: SizedBox(height: 30)),
          ],
        ),
      ),
    );
  }

  Widget _notification(Map<String, dynamic> item) {
    final id = (item['_id'] ?? '').toString();
    final read = item['isRead'] == true;
    final category = _category(item);
    final route = _safeRoute(item);
    final status = _status(item);
    return Dismissible(
      key: ValueKey(id),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) => _confirmDelete(item),
      background: Container(
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 20),
          color: KhatuColors.softRed,
          child: const Icon(Icons.delete_outline, color: KhatuColors.danger)),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
            color: read ? Colors.white : const Color(0xFFEAF8F5),
            border: Border.all(color: KhatuColors.line),
            borderRadius: BorderRadius.circular(8)),
        child: ListTile(
          onTap: () async {
            if (!read) await _mark(item, true);
            if (route != null) router.push(route);
          },
          leading: Stack(clipBehavior: Clip.none, children: [
            Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                    color: _color(category).withValues(alpha: .1),
                    borderRadius: BorderRadius.circular(8)),
                child:
                    Icon(_icon(category), color: _color(category), size: 21)),
            if (!read)
              Positioned(
                  right: -2,
                  top: -2,
                  child: Container(
                      width: 9,
                      height: 9,
                      decoration: const BoxDecoration(
                          color: KhatuColors.teal, shape: BoxShape.circle))),
          ]),
          title: Text((item['title'] ?? 'Khatu Pay update').toString(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontWeight: read ? FontWeight.w700 : FontWeight.w900)),
          subtitle:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 3),
            Text((item['message'] ?? item['body'] ?? '').toString(),
                maxLines: 3, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 6),
            Wrap(
                spacing: 7,
                runSpacing: 5,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  if (status.isNotEmpty)
                    KpStatusBadge(status: status, dense: true),
                  if (item['actionRequired'] == true)
                    const Text('Action required',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: KhatuColors.warning)),
                  Text(_time(item['createdAt']),
                      style: const TextStyle(
                          fontSize: 11, color: KhatuColors.muted)),
                ]),
          ]),
          trailing: PopupMenuButton<String>(
            tooltip: 'Notification options',
            onSelected: (value) {
              if (value == 'toggle') _mark(item, read ? false : true);
              if (value == 'delete') _confirmDelete(item);
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                  value: 'toggle',
                  child: Text(read ? 'Mark as unread' : 'Mark as read')),
              const PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
          isThreeLine: true,
        ),
      ),
    );
  }

  Map<String, List<Map<String, dynamic>>> _group(
      List<Map<String, dynamic>> rows) {
    final result = <String, List<Map<String, dynamic>>>{};
    for (final row in rows) {
      result.putIfAbsent(_dateGroup(row['createdAt']), () => []).add(row);
    }
    return result;
  }

  String _category(Map<String, dynamic> item) {
    final raw =
        '${item['category'] ?? item['type'] ?? item['data']?['category'] ?? ''}'
            .toLowerCase();
    if (raw.contains('recharge') || raw.contains('dth')) return 'Recharge';
    if (raw.contains('bill') || raw.contains('fastag')) return 'Bills';
    if (raw.contains('loan')) return 'Loans';
    if (raw.contains('business') ||
        raw.contains('merchant') ||
        raw.contains('settlement')) return 'Business';
    if (raw.contains('security') ||
        raw.contains('login') ||
        raw.contains('kyc')) return 'Security';
    return 'All';
  }

  String _status(Map<String, dynamic> item) =>
      '${item['data']?['status'] ?? item['status'] ?? ''}';
  String? _safeRoute(Map<String, dynamic> item) {
    final route = '${item['data']?['route'] ?? item['route'] ?? ''}';
    final uri = Uri.tryParse(route);
    if (uri == null || uri.hasScheme) return null;
    const allowed = {
      '/notifications',
      '/service-history',
      '/loans',
      '/kyc',
      '/settings',
      '/support',
      '/business',
      '/business/transactions',
      '/business/settlements',
      '/business/qr'
    };
    if (allowed.contains(uri.path) ||
        RegExp(r'^/loan/[a-zA-Z0-9_-]+$').hasMatch(uri.path)) return route;
    return null;
  }

  String _dateGroup(dynamic value) {
    final date = DateTime.tryParse('$value')?.toLocal();
    if (date == null) return 'Earlier';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(date.year, date.month, date.day);
    if (day == today) return 'Today';
    if (day == today.subtract(const Duration(days: 1))) return 'Yesterday';
    return 'Earlier';
  }

  String _time(dynamic value) {
    final date = DateTime.tryParse('$value')?.toLocal();
    if (date == null) return '';
    final difference = DateTime.now().difference(date);
    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inHours < 1) return '${difference.inMinutes}m ago';
    if (difference.inDays < 1) return '${difference.inHours}h ago';
    return DateFormat('dd MMM, hh:mm a').format(date);
  }

  IconData _icon(String category) => switch (category) {
        'Recharge' => Icons.phone_android_rounded,
        'Bills' => Icons.receipt_long_outlined,
        'Loans' => Icons.description_outlined,
        'Business' => Icons.storefront_outlined,
        'Security' => Icons.security_outlined,
        _ => Icons.notifications_none_rounded,
      };
  Color _color(String category) => switch (category) {
        'Recharge' => KhatuColors.teal,
        'Bills' => KhatuColors.info,
        'Loans' => KhatuColors.warning,
        'Business' => KhatuColors.deepTeal,
        'Security' => KhatuColors.danger,
        _ => KhatuColors.muted,
      };
}

class _NotificationSkeleton extends StatelessWidget {
  const _NotificationSkeleton();
  @override
  Widget build(BuildContext context) => Container(
      height: 82,
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
          color: KhatuColors.surfaceAlt,
          borderRadius: BorderRadius.circular(8)));
}

class _EmptyInbox extends StatelessWidget {
  const _EmptyInbox({required this.filtered});
  final bool filtered;
  @override
  Widget build(BuildContext context) => Center(
          child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Image.asset('assets/notifications/notification_inbox.png',
              height: 150),
          const SizedBox(height: 16),
          Text(
              filtered
                  ? 'No notifications match these filters'
                  : "You're all caught up",
              style: KhatuText.h2,
              textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text(
              filtered
                  ? 'Try another category or show all notifications.'
                  : 'Recharge, bill, loan and business updates will appear here.',
              style: KhatuText.bodyMuted,
              textAlign: TextAlign.center),
        ]),
      ));
}
