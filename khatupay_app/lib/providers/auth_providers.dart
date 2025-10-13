import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/user_service.dart';

final authServiceProvider = Provider((_) => AuthService());
final userServiceProvider = Provider((_) => UserService());

final meProvider = FutureProvider<KPUser>((ref) async {
  final u = await ref.read(userServiceProvider).me();
  return u;
});
