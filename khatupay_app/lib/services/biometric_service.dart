import 'package:local_auth/local_auth.dart';
import 'package:flutter/services.dart';

class BiometricService {
  static final BiometricService _instance = BiometricService._internal();
  factory BiometricService() => _instance;

  BiometricService._internal();

  final LocalAuthentication _localAuth = LocalAuthentication();

  Future<bool> isBiometricAvailable() async {
    try {
      final canAuthenticateWithBiometrics = await _localAuth.canCheckBiometrics;
      final canAuthenticate = await _localAuth.isDeviceSupported();
      return canAuthenticateWithBiometrics && canAuthenticate;
    } on PlatformException {
      return false;
    }
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } on PlatformException {
      return [];
    }
  }

  Future<bool> authenticate({
    String reason = 'Please authenticate to proceed',
    bool useErrorDialogs = true,
    bool stickyAuth = true,
    bool biometricOnly = false,
  }) async {
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason: reason,
        options: AuthenticationOptions(
          useErrorDialogs: useErrorDialogs,
          stickyAuth: stickyAuth,
          biometricOnly: biometricOnly,
        ),
      );
      return authenticated;
    } on PlatformException {
      return false;
    }
  }

  Future<bool> authenticateForPayment({
    required double amount,
    required String description,
  }) async {
    final reason = 'Authenticate to pay ₹${amount.toStringAsFixed(2)} for $description';
    return await authenticate(reason: reason);
  }

  Future<bool> authenticateForSensitiveAction({
    String action = 'perform this action',
  }) async {
    final reason = 'Please authenticate to $action';
    return await authenticate(reason: reason);
  }

  String getBiometricTypeName(BiometricType type) {
    switch (type) {
      case BiometricType.face:
        return 'Face ID';
      case BiometricType.fingerprint:
        return 'Fingerprint';
      case BiometricType.iris:
        return 'Iris';
      case BiometricType.strong:
        return 'Strong';
      case BiometricType.weak:
        return 'Weak';
      default:
        return 'Biometric';
    }
  }

  Future<String> getAvailableBiometricTypesString() async {
    final biometrics = await getAvailableBiometrics();
    if (biometrics.isEmpty) return 'None';

    return biometrics.map((type) => getBiometricTypeName(type)).join(', ');
  }
}
