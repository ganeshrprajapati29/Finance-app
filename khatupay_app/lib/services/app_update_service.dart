import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../core/config.dart';

class AppUpdatePolicy {
  final String latestVersion;
  final int latestBuild;
  final int minimumSupportedBuild;
  final bool forceUpdate;
  final String message;
  final String storeUrl;
  final int installedBuild;

  const AppUpdatePolicy({
    required this.latestVersion,
    required this.latestBuild,
    required this.minimumSupportedBuild,
    required this.forceUpdate,
    required this.message,
    required this.storeUrl,
    required this.installedBuild,
  });

  bool get updateRequired =>
      forceUpdate && installedBuild < minimumSupportedBuild;

  factory AppUpdatePolicy.fromJson(Map<String, dynamic> json, int installed) {
    return AppUpdatePolicy(
      latestVersion: json['latestVersion']?.toString() ?? '',
      latestBuild: int.tryParse('${json['latestBuild']}') ?? installed,
      minimumSupportedBuild:
          int.tryParse('${json['minimumSupportedBuild']}') ?? installed,
      forceUpdate: json['forceUpdate'] == true,
      message: json['message']?.toString().trim().isNotEmpty == true
          ? json['message'].toString().trim()
          : 'A new Khatu Pay update is required to continue.',
      storeUrl: json['storeUrl']?.toString() ?? '',
      installedBuild: installed,
    );
  }
}

class AppUpdateService {
  AppUpdateService._();

  static const _storage = FlutterSecureStorage();
  static const _cacheKey = 'android_app_update_policy_v1';

  static Future<AppUpdatePolicy?> check() async {
    final package = await PackageInfo.fromPlatform();
    final installedBuild = int.tryParse(package.buildNumber) ?? 1;

    try {
      final dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.baseUrl,
          connectTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        ),
      );
      final response = await dio.get('/app-version/android');
      final envelope = response.data;
      final raw = envelope is Map ? envelope['data'] : null;
      if (raw is! Map) return _cached(installedBuild);
      final json = Map<String, dynamic>.from(raw);
      await _storage.write(key: _cacheKey, value: jsonEncode(json));
      return AppUpdatePolicy.fromJson(json, installedBuild);
    } catch (_) {
      return _cached(installedBuild);
    }
  }

  static Future<AppUpdatePolicy?> _cached(int installedBuild) async {
    try {
      final value = await _storage.read(key: _cacheKey);
      if (value == null || value.isEmpty) return null;
      return AppUpdatePolicy.fromJson(
        Map<String, dynamic>.from(jsonDecode(value) as Map),
        installedBuild,
      );
    } catch (_) {
      return null;
    }
  }
}
