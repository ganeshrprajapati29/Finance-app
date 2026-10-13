import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/app_theme.dart';
import '../../../core/friendly_error.dart';
import '../../../models/business/merchant_business.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../routes/app_router.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../widgets/kp_widgets.dart';
import 'business_widgets.dart';

/// Step 5 of business setup: payment activation status. Shows where the
/// application is, what (if anything) is still needed, and lets the owner
/// upload business documents.
class BusinessVerificationPage extends ConsumerStatefulWidget {
  const BusinessVerificationPage({super.key});
  @override
  ConsumerState<BusinessVerificationPage> createState() => _State();
}

class _State extends ConsumerState<BusinessVerificationPage> {
  final details = TextEditingController();
  bool busy = false;
  String? busyLabel;
  String? notice, error;
  String? proofPath, proofName;

  @override
  void dispose() {
    details.dispose();
    super.dispose();
  }

  Future<void> _run(String label, Future<String?> Function() work) async {
    if (busy) return;
    setState(() {
      busy = true;
      busyLabel = label;
      error = null;
      notice = null;
    });
    try {
      final message = await work();
      ref.invalidate(merchantDashboardProvider);
      if (mounted && message != null) setState(() => notice = message);
    } catch (e) {
      if (mounted) {
        setState(() => error = friendlyErrorMessage(e,
            fallback: 'That did not go through. Please try again.'));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> refreshStatus() => _run('Checking status...', () async {
        final result = await MerchantBusinessService().syncRazorpayOnboarding();
        return result['queued'] == true
            ? 'Your application is with the KhatuPay team. We will notify you when payments are activated.'
            : 'Verification status is up to date.';
      });

  Future<void> pickProof() async {
    final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png']);
    final file = result?.files.single;
    if (file?.path == null || !mounted) return;
    if (file!.size > 4 * 1024 * 1024) {
      setState(() => error = 'Choose a file smaller than 4 MB.');
      return;
    }
    setState(() {
      proofPath = file.path;
      proofName = file.name;
      error = null;
    });
  }

  Future<void> uploadProof(MerchantDashboard data) =>
      _run('Uploading document...', () async {
        if (proofPath == null) return null;
        final service = MerchantBusinessService();
        final url = await service.uploadBusinessDocument(proofPath!);
        if (url.isEmpty) throw Exception('The document could not be uploaded.');
        final request = data.business?.onboardingRequest ?? const {};
        await service.submitKyc({
          'gstNumber': (request['gstNumber'] ?? data.kyc?['gstNumber'] ?? '').toString(),
          'businessType': (request['businessType'] ?? data.kyc?['businessType'] ?? 'proprietorship').toString(),
          'businessProofUrl': url,
        });
        // Forward it to the payment provider when the account already exists.
        if (data.business?.razorpay?['accountId'] != null) {
          try {
            await service.submitRazorpayDocuments([
              {'documentType': 'business_proof_url', 'fileUrl': url}
            ]);
          } catch (_) {
            // Stored with KhatuPay; the team can forward it during review.
          }
        }
        if (mounted) {
          setState(() {
            proofPath = null;
            proofName = null;
          });
        }
        return 'Document uploaded. It will be reviewed with your application.';
      });

  Future<void> resubmitDetails() => _run('Submitting...', () async {
        if (details.text.trim().length < 10) {
          throw Exception('Describe your business activity in at least 10 characters.');
        }
        await MerchantBusinessService().updateRazorpayProduct(
            {'businessModel': details.text.trim(), 'termsAccepted': true});
        details.clear();
        return 'Updated details were submitted for review.';
      });

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(merchantDashboardProvider);
    return KpAppShell(
      title: 'Payment activation',
      onRefresh: () async => ref.invalidate(merchantDashboardProvider),
      children: [
        dashboard.when(
          loading: () => const Padding(
              padding: EdgeInsets.only(top: 80),
              child: Center(child: CircularProgressIndicator())),
          error: (e, _) => KpErrorState.fromError(e,
              onRetry: () => ref.invalidate(merchantDashboardProvider)),
          data: (data) {
            final business = data.business;
            if (business == null) {
              return KpEmptyState(
                title: 'Create your business profile first',
                message: 'Payment activation starts after you add your business.',
                icon: Icons.storefront_outlined,
                actionLabel: 'Start business setup',
                onAction: () => router.go('/business/register'),
              );
            }
            final onboarding = data.onboarding;
            final activation = onboarding.step('activation');
            final status = activation?.status ?? 'LOCKED';
            final style = businessStepStyle(status);
            final submittedDetails = onboarding.step('businessDetails')?.isDone ?? false;
            final documents = Map<String, dynamic>.from(data.kyc?['documents'] ?? const {});
            final hasProof = (documents['businessProofUrl'] ?? '').toString().isNotEmpty;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _StatusHero(
                  business: business.businessName,
                  status: status,
                  title: switch (status) {
                    'DONE' => 'Payments are activated',
                    'CURRENT' => 'A few more details are needed',
                    'REVIEW' => 'Application under review',
                    'FAILED' => 'Application needs attention',
                    _ => 'Not submitted yet',
                  },
                  message: activation?.message ?? '',
                  color: style.color,
                  icon: status == 'DONE'
                      ? Icons.verified_rounded
                      : status == 'REVIEW'
                          ? Icons.hourglass_top_rounded
                          : status == 'FAILED'
                              ? Icons.error_outline_rounded
                              : Icons.fact_check_outlined,
                ),
                const SizedBox(height: 12),
                if (notice != null) ...[
                  KpNoticeBanner(
                      icon: Icons.check_circle_outline,
                      color: KhatuColors.success,
                      message: notice!),
                  const SizedBox(height: 12),
                ],
                if (error != null) ...[
                  KpErrorBanner(message: error!),
                  const SizedBox(height: 12),
                ],
                if (!submittedDetails)
                  BusinessPrimaryButton(
                      label: 'Continue business setup',
                      onPressed: () => router.go('/business'))
                else if (status == 'DONE')
                  BusinessPrimaryButton(
                      label: onboarding.qrActive ? 'Open my business QR' : 'Create my business QR',
                      icon: Icons.qr_code_2_rounded,
                      onPressed: () => router.push('/business/qr'))
                else
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: busy ? null : refreshStatus,
                      icon: busy
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.refresh_rounded, size: 18),
                      label: Text(busy ? (busyLabel ?? 'Please wait...') : 'Check latest status'),
                    ),
                  ),
                if (onboarding.requirements.isNotEmpty && status != 'DONE') ...[
                  const KpSectionHeader(
                      title: 'What is still needed',
                      subtitle: 'Provide these to finish verification'),
                  KpCard(
                    radius: KhatuRadius.lg,
                    child: Column(children: [
                      for (final item in onboarding.requirements)
                        _RequirementRow(
                          requirement: item,
                          onFix: item.kind == 'BANK'
                              ? () => router.push('/business/bank')
                              : null,
                        ),
                    ]),
                  ),
                  if (onboarding.requirements.any((r) => r.kind == 'DETAIL') &&
                      business.status == 'NEEDS_CLARIFICATION') ...[
                    const SizedBox(height: 12),
                    KpCard(
                      radius: KhatuRadius.lg,
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Update business activity',
                                style: TextStyle(
                                    fontFamily: 'Roboto',
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14.5)),
                            const SizedBox(height: 10),
                            BusinessField(
                              controller: details,
                              label: 'What do you sell or provide?',
                              maxLines: 2,
                              maxLength: 255,
                              icon: Icons.sell_outlined,
                            ),
                            BusinessPrimaryButton(
                                label: 'Resubmit for review',
                                icon: Icons.send_rounded,
                                busy: busy,
                                busyLabel: busyLabel,
                                onPressed: resubmitDetails),
                          ]),
                    ),
                  ],
                ],
                if (submittedDetails && status != 'DONE') ...[
                  const KpSectionHeader(
                      title: 'Business proof',
                      subtitle: 'Speeds up verification (optional)'),
                  KpCard(
                    radius: KhatuRadius.lg,
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Icon(
                                hasProof
                                    ? Icons.task_alt_rounded
                                    : Icons.description_outlined,
                                color: hasProof
                                    ? KhatuColors.success
                                    : KhatuColors.deepTeal),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                  hasProof
                                      ? 'A business document is on file.'
                                      : 'GST certificate, shop licence, Udyam certificate or any business registration.',
                                  style: const TextStyle(
                                      fontFamily: 'Roboto',
                                      fontSize: 13,
                                      height: 1.4)),
                            ),
                          ]),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: busy ? null : pickProof,
                              icon: const Icon(Icons.attach_file_rounded, size: 18),
                              label: Text(proofName ??
                                  (hasProof
                                      ? 'Choose another document'
                                      : 'Choose PDF or photo (max 4 MB)')),
                            ),
                          ),
                          if (proofPath != null) ...[
                            const SizedBox(height: 10),
                            BusinessPrimaryButton(
                                label: 'Upload document',
                                icon: Icons.cloud_upload_outlined,
                                busy: busy,
                                busyLabel: busyLabel,
                                onPressed: () => uploadProof(data)),
                          ],
                        ]),
                  ),
                ],
                const KpSectionHeader(title: 'Your setup'),
                KpCard(
                  radius: KhatuRadius.lg,
                  child: Column(children: [
                    for (var i = 0; i < onboarding.steps.length; i++)
                      BusinessStepTile(
                        index: i,
                        step: onboarding.steps[i],
                        isLast: i == onboarding.steps.length - 1,
                      ),
                  ]),
                ),
                const SizedBox(height: 14),
                Center(
                  child: TextButton.icon(
                    onPressed: () =>
                        router.push('/support?subject=Business%20activation'),
                    icon: const Icon(Icons.support_agent_rounded, size: 18),
                    label: const Text('Need help? Contact support'),
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _StatusHero extends StatelessWidget {
  const _StatusHero(
      {required this.business,
      required this.status,
      required this.title,
      required this.message,
      required this.color,
      required this.icon});
  final String business, status, title, message;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(KhatuRadius.xl),
          border: Border.all(color: color.withValues(alpha: 0.35), width: 1.2),
          boxShadow: KhatuShadow.soft,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(business.toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontFamily: 'Roboto',
                            color: KhatuColors.muted,
                            fontSize: 10.5,
                            letterSpacing: 0.8,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 3),
                    Text(title,
                        style: const TextStyle(
                            fontFamily: 'Roboto',
                            fontSize: 18,
                            fontWeight: FontWeight.w900)),
                  ]),
            ),
          ]),
          if (message.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(message,
                style: const TextStyle(
                    fontFamily: 'Roboto',
                    color: KhatuColors.muted,
                    fontSize: 13.5,
                    height: 1.5)),
          ],
        ]),
      );
}

class _RequirementRow extends StatelessWidget {
  const _RequirementRow({required this.requirement, this.onFix});
  final MerchantRequirement requirement;
  final VoidCallback? onFix;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
                color: KhatuColors.softSaffron,
                borderRadius: BorderRadius.circular(10)),
            child: Icon(
                switch (requirement.kind) {
                  'DOCUMENT' => Icons.description_outlined,
                  'BANK' => Icons.account_balance_outlined,
                  _ => Icons.edit_note_rounded,
                },
                size: 19,
                color: KhatuColors.gold),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(requirement.label,
                      style: const TextStyle(
                          fontFamily: 'Roboto',
                          fontSize: 14,
                          fontWeight: FontWeight.w800)),
                  if (requirement.reason.isNotEmpty)
                    Text(
                        '${requirement.reason[0].toUpperCase()}${requirement.reason.substring(1)}',
                        style: const TextStyle(
                            fontFamily: 'Roboto',
                            fontSize: 12,
                            color: KhatuColors.muted)),
                ]),
          ),
          if (onFix != null)
            TextButton(onPressed: onFix, child: const Text('Update')),
        ]),
      );
}
