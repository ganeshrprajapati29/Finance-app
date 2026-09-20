import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../core/friendly_error.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../../routes/app_router.dart';
import '../../widgets/kp_widgets.dart';

class BusinessRegistrationPage extends StatefulWidget { const BusinessRegistrationPage({super.key}); @override State<BusinessRegistrationPage> createState() => _State(); }
class _State extends State<BusinessRegistrationPage> {
  final key = GlobalKey<FormState>(); final name = TextEditingController(), owner = TextEditingController(), mobile = TextEditingController(), email = TextEditingController(), address = TextEditingController();
  String category = 'Retail store'; bool busy = false; String? error;
  @override void dispose() { for (final c in [name, owner, mobile, email, address]) { c.dispose(); } super.dispose(); }
  Future<void> submit() async { if (!(key.currentState?.validate() ?? false)) return; setState(() { busy = true; error = null; }); try { await MerchantBusinessService().create({'businessName': name.text.trim(), 'ownerName': owner.text.trim(), 'category': category, 'mobile': mobile.text.trim(), 'email': email.text.trim(), 'address': address.text.trim()}); if (mounted) router.go('/business/verification'); } catch (e) { if (mounted) setState(() => error = friendlyErrorMessage(e, fallback: 'Business profile could not be created.')); } finally { if (mounted) setState(() => busy = false); } }
  @override Widget build(BuildContext context) => KpAppShell(title: 'Business registration', subtitle: 'Tell us about the business that will accept payments', children: [
    if (error != null) KpErrorBanner(message: error!), Form(key: key, child: KpCard(child: Column(children: [
      _field(name, 'Business name', Icons.storefront_outlined), _field(owner, 'Owner name', Icons.person_outline),
      DropdownButtonFormField<String>(initialValue: category, decoration: const InputDecoration(labelText: 'Business category', prefixIcon: Icon(Icons.category_outlined)), items: ['Retail store','Professional services','Food and beverages','Fashion and lifestyle','Other'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(), onChanged: (v) => category = v ?? category), const SizedBox(height: 12),
      _field(mobile, 'Business mobile', Icons.phone_outlined, phone: true), _field(email, 'Email', Icons.email_outlined, optional: true), _field(address, 'Business address', Icons.location_on_outlined),
      const SizedBox(height: 8), SizedBox(width: double.infinity, child: ElevatedButton.icon(onPressed: busy ? null : submit, icon: const Icon(Icons.arrow_forward_rounded), label: Text(busy ? 'Saving...' : 'Continue to verification')))
    ])))
  ]);
  Widget _field(TextEditingController c, String label, IconData icon, {bool phone = false, bool optional = false}) => Padding(padding: const EdgeInsets.only(bottom: 12), child: TextFormField(controller: c, keyboardType: phone ? TextInputType.phone : TextInputType.text, decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)), validator: (v) { if (!optional && (v ?? '').trim().isEmpty) return '$label is required'; if (phone && !RegExp(r'^[6-9]\d{9}$').hasMatch((v ?? '').trim())) return 'Enter a valid 10-digit mobile number'; return null; }));
}
