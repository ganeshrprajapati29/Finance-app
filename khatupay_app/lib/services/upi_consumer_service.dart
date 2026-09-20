import '../core/api_client.dart';

class UpiConsumerService {
  final _dio = ApiClient.client;

  Future<Map<String, dynamic>> setup() async {
    final r = await _dio.get('/upi-consumer/setup');
    return Map<String, dynamic>.from(r.data['data'] ?? {});
  }

  Future<Map<String, dynamic>> smsToken({
    required String mobile,
    required String deviceFingerPrint,
  }) async {
    return _post('/upi-consumer/sms-token', {
      'mobile': mobile,
      'deviceFingerPrint': deviceFingerPrint,
    });
  }

  Future<Map<String, dynamic>> bindDevice({
    required String mobile,
    required String smsToken,
    required String deviceFingerPrint,
  }) async {
    return _post('/upi-consumer/bind-device', {
      'mobile': mobile,
      'smsToken': smsToken,
      'deviceFingerPrint': deviceFingerPrint,
    });
  }

  Future<Map<String, dynamic>> fetchAccounts({
    required String mobile,
    required String deviceFingerPrint,
    String? bankCode,
  }) async {
    return _post('/upi-consumer/accounts/fetch', {
      'mobile': mobile,
      'deviceFingerPrint': deviceFingerPrint,
      if (bankCode != null && bankCode.isNotEmpty) 'bankCode': bankCode,
    });
  }

  Future<Map<String, dynamic>> checkBalance({
    required String bankAccountUniqueId,
    required String payerVpa,
    required String credBlock,
    required String deviceFingerPrint,
  }) async {
    return _post('/upi-consumer/balance', {
      'bankAccountUniqueId': bankAccountUniqueId,
      'payerVpa': payerVpa,
      'credBlock': credBlock,
      'deviceFingerPrint': deviceFingerPrint,
    });
  }

  Future<Map<String, dynamic>> verifyVpa(String vpa) {
    return _post('/upi-consumer/vpa/verify', {'vpa': vpa});
  }

  Future<Map<String, dynamic>> setMpin({
    required String bankAccountUniqueId,
    required String payerVpa,
    required String credBlock,
    required String deviceFingerPrint,
  }) {
    return _mpin('/upi-consumer/mpin/set',
        bankAccountUniqueId, payerVpa, credBlock, deviceFingerPrint);
  }

  Future<Map<String, dynamic>> changeMpin({
    required String bankAccountUniqueId,
    required String payerVpa,
    required String credBlock,
    required String deviceFingerPrint,
  }) {
    return _mpin('/upi-consumer/mpin/change',
        bankAccountUniqueId, payerVpa, credBlock, deviceFingerPrint);
  }

  Future<Map<String, dynamic>> resetMpin({
    required String bankAccountUniqueId,
    required String payerVpa,
    required String credBlock,
    required String deviceFingerPrint,
  }) {
    return _mpin('/upi-consumer/mpin/reset',
        bankAccountUniqueId, payerVpa, credBlock, deviceFingerPrint);
  }

  Future<Map<String, dynamic>> sendMoney({
    required String bankAccountUniqueId,
    required String payerVpa,
    required String payeeVpa,
    required String payeeName,
    required double amount,
    required String credBlock,
    required String deviceFingerPrint,
    String remarks = 'Khatu Pay',
  }) async {
    return _post('/upi-consumer/send-money', {
      'bankAccountUniqueId': bankAccountUniqueId,
      'payerVpa': payerVpa,
      'payeeVpa': payeeVpa,
      'payeeName': payeeName,
      'amount': amount,
      'credBlock': credBlock,
      'deviceFingerPrint': deviceFingerPrint,
      'remarks': remarks,
    });
  }

  Future<Map<String, dynamic>> requestMoney({
    required String payerVpa,
    required String payeeVpa,
    required double amount,
    String remarks = 'Khatu Pay collect',
  }) async {
    return _post('/upi-consumer/request-money', {
      'payerVpa': payerVpa,
      'payeeVpa': payeeVpa,
      'amount': amount,
      'remarks': remarks,
    });
  }

  Future<Map<String, dynamic>> transactionStatus(String merchantRequestId) {
    return _post('/upi-consumer/transactions/status', {
      'merchantRequestId': merchantRequestId,
    });
  }

  Future<Map<String, dynamic>> transactions() {
    return _post('/upi-consumer/transactions/list', {});
  }

  Future<Map<String, dynamic>> checkUpiNumber(String upiNumber) {
    return _post('/upi-consumer/upi-number/check', {'upiNumber': upiNumber});
  }

  Future<Map<String, dynamic>> createUpiNumber(String upiNumber, String vpa) {
    return _post('/upi-consumer/upi-number/create', {'upiNumber': upiNumber, 'vpa': vpa});
  }

  Future<Map<String, dynamic>> upiLiteStatus({String? bankAccountUniqueId, String? payerVpa}) {
    return _post('/upi-consumer/upi-lite/status', {
      if (bankAccountUniqueId != null) 'bankAccountUniqueId': bankAccountUniqueId,
      if (payerVpa != null) 'payerVpa': payerVpa,
    });
  }

  Future<Map<String, dynamic>> raiseComplaint({
    required String originalMerchantRequestId,
    required String reason,
    String? description,
  }) {
    return _post('/upi-consumer/complaints/raise', {
      'originalMerchantRequestId': originalMerchantRequestId,
      'reason': reason,
      if (description != null) 'description': description,
    });
  }

  Future<Map<String, dynamic>> complaintStatus(String complaintRequestId) {
    return _post('/upi-consumer/complaints/status', {
      'complaintRequestId': complaintRequestId,
    });
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> data) async {
    final r = await _dio.post(path, data: data);
    return Map<String, dynamic>.from(r.data['data'] ?? r.data ?? {});
  }

  Future<Map<String, dynamic>> _mpin(
    String path,
    String bankAccountUniqueId,
    String payerVpa,
    String credBlock,
    String deviceFingerPrint,
  ) {
    return _post(path, {
      'bankAccountUniqueId': bankAccountUniqueId,
      'payerVpa': payerVpa,
      'credBlock': credBlock,
      'deviceFingerPrint': deviceFingerPrint,
    });
  }
}
