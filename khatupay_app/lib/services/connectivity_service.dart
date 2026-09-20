import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

class ConnectivityService {
  static final ConnectivityService _instance = ConnectivityService._internal();
  factory ConnectivityService() => _instance;

  ConnectivityService._internal() {
    _initConnectivity();
    _connectivity.onConnectivityChanged.listen(_updateConnectionStatus);
  }

  final Connectivity _connectivity = Connectivity();
  final StreamController<ConnectivityResult> _connectivityController =
      StreamController<ConnectivityResult>.broadcast();

  ConnectivityResult _connectionStatus = ConnectivityResult.none;

  ConnectivityResult get connectionStatus => _connectionStatus;
  Stream<ConnectivityResult> get connectivityStream => _connectivityController.stream;

  Future<void> _initConnectivity() async {
    try {
      final result = await _connectivity.checkConnectivity();
      _updateConnectionStatus(result);
    } catch (e) {
      print('Failed to get connectivity: $e');
    }
  }

  void _updateConnectionStatus(List<ConnectivityResult> results) {
    final result = results.contains(ConnectivityResult.none) && results.length == 1
        ? ConnectivityResult.none
        : results.firstWhere(
            (status) => status != ConnectivityResult.none,
            orElse: () => ConnectivityResult.none,
          );
    _connectionStatus = result;
    _connectivityController.add(result);
  }

  bool get isConnected {
    return _connectionStatus != ConnectivityResult.none;
  }

  bool get isWifi {
    return _connectionStatus == ConnectivityResult.wifi;
  }

  bool get isMobile {
    return _connectionStatus == ConnectivityResult.mobile;
  }

  Future<bool> checkInternetConnectivity() async {
    try {
      final result = await _connectivity.checkConnectivity();
      return result.any((status) => status != ConnectivityResult.none);
    } catch (e) {
      return false;
    }
  }

  void dispose() {
    _connectivityController.close();
  }

  // Show connectivity status snackbar
  void showConnectivitySnackBar(BuildContext context, ConnectivityResult status) {
    final isConnected = status != ConnectivityResult.none;
    final message = isConnected
        ? 'Connected to ${status.name}'
        : 'No internet connection';

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isConnected ? Colors.green : Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }
}
