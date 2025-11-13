import 'package:flutter/material.dart';
import '../../services/loan_service.dart';
import '../../models/loan.dart';
import '../../routes/app_router.dart';

class LoanDetailPage extends StatefulWidget {
  final String id;
  final Loan? loan;

  const LoanDetailPage({super.key, required this.id, this.loan});

  @override
  State<LoanDetailPage> createState() => _LoanDetailPageState();
}

class _LoanDetailPageState extends State<LoanDetailPage> {
  Loan? loan;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final l = await LoanService().detail(widget.id);
      if (mounted) setState(() => loan = l);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load loan details: $e')),
      );
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'PENDING': return Colors.orange;
      case 'APPROVED': return Colors.green;
      case 'REJECTED': return Colors.red;
      case 'DISBURSED': return Colors.blue;
      case 'CLOSED': return Colors.grey;
      default: return Colors.grey;
    }
  }

  String _getDaysUntilDue(DateTime dueDate) {
    final now = DateTime.now();
    final difference = dueDate.difference(now).inDays;
    if (difference < 0) {
      return '${difference.abs()} days overdue';
    } else if (difference == 0) {
      return 'Due today';
    } else {
      return '$difference days left';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Loan Detail'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => router.go('/loans'),
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : loan == null
              ? const Center(child: Text('Loan not found'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Status Card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Text('Status: ', style: TextStyle(fontWeight: FontWeight.bold)),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: _getStatusColor(loan!.status),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: Text(
                                      loan!.status,
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text('Application ID: ${loan!.id.substring(loan!.id.length - 8)}',
                                  style: const TextStyle(color: Colors.grey)),
                              if (loan!.createdAt != null)
                                Text('Applied: ${loan!.createdAt!.toLocal().toString().split(' ')[0]}',
                                    style: const TextStyle(color: Colors.grey)),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Application Details
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Loan Application', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 12),
                              _detailRow('Requested Amount', '₹${loan!.application.amountRequested.toStringAsFixed(0)}'),
                              _detailRow('Tenure', '${loan!.application.tenureMonths} months'),
                              _detailRow('Purpose', loan!.application.purpose),
                              if (loan!.application.personal != null) ...[
                                const SizedBox(height: 12),
                                const Text('Personal Information', style: TextStyle(fontWeight: FontWeight.w600)),
                                _detailRow('Name', loan!.application.personal!['name'] ?? 'N/A'),
                                _detailRow('Email', loan!.application.personal!['email'] ?? 'N/A'),
                                _detailRow('Mobile', loan!.application.personal!['mobile'] ?? 'N/A'),
                                _detailRow('Address', loan!.application.personal!['address'] ?? 'N/A'),
                                _detailRow('Father Name', loan!.application.personal!['fatherName'] ?? 'N/A'),
                                _detailRow('Mother Name', loan!.application.personal!['motherName'] ?? 'N/A'),
                              ],
                              if (loan!.application.employment != null) ...[
                                const SizedBox(height: 12),
                                const Text('Employment Details', style: TextStyle(fontWeight: FontWeight.w600)),
                                _detailRow('Type', loan!.application.employment!['employmentType'] ?? 'N/A'),
                                _detailRow('Monthly Income', '₹${loan!.application.employment!['monthlyIncome'] ?? 0}'),
                                _detailRow('Employer/Business', loan!.application.employment!['employerOrBusiness'] ?? 'N/A'),
                                _detailRow('Experience', '${loan!.application.employment!['experienceYears'] ?? 0} years'),
                              ],
                              if (loan!.application.qualification != null) ...[
                                const SizedBox(height: 12),
                                const Text('Qualification Details', style: TextStyle(fontWeight: FontWeight.w600)),
                                _detailRow('Education', loan!.application.qualification!['highestEducation'] ?? 'N/A'),
                                _detailRow('Stream', loan!.application.qualification!['stream'] ?? 'N/A'),
                                _detailRow('Institution', loan!.application.qualification!['institution'] ?? 'N/A'),
                              ],
                              if (loan!.application.documents != null) ...[
                                const SizedBox(height: 12),
                                const Text('Documents', style: TextStyle(fontWeight: FontWeight.w600)),
                                _detailRow('Aadhaar Front', loan!.application.documents!['aadhaarFrontUrl'] != null ? 'Uploaded' : 'Not uploaded'),
                                _detailRow('Aadhaar Back', loan!.application.documents!['aadhaarBackUrl'] != null ? 'Uploaded' : 'Not uploaded'),
                                _detailRow('PAN Card', loan!.application.documents!['panUrl'] != null ? 'Uploaded' : 'Not uploaded'),
                                _detailRow('Selfie', loan!.application.documents!['selfieUrl'] != null ? 'Uploaded' : 'Not uploaded'),
                              ],
                              if (loan!.application.references != null && loan!.application.references!.isNotEmpty) ...[
                                const SizedBox(height: 12),
                                const Text('References', style: TextStyle(fontWeight: FontWeight.w600)),
                                ...loan!.application.references!.asMap().entries.map((entry) {
                                  final index = entry.key + 1;
                                  final ref = entry.value as Map<String, dynamic>;
                                  return Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('Reference $index:', style: const TextStyle(fontWeight: FontWeight.w500)),
                                      _detailRow('Name', ref['name'] ?? 'N/A'),
                                      _detailRow('Relation', ref['relation'] ?? 'N/A'),
                                      _detailRow('Mobile', ref['mobile'] ?? 'N/A'),
                                      if (index < loan!.application.references!.length) const SizedBox(height: 8),
                                    ],
                                  );
                                }),
                              ],
                            ],
                          ),
                        ),
                      ),

                      // Decision Details
                      if (loan!.decision != null) ...[
                        const SizedBox(height: 16),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Approved Terms', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.green)),
                                const SizedBox(height: 12),
                                _detailRow('Approved Amount', '₹${loan!.decision!.amountApproved?.toStringAsFixed(0) ?? 'N/A'}'),
                                _detailRow('Interest Rate', '${loan!.decision!.rateAPR?.toStringAsFixed(1) ?? 'N/A'}% APR'),
                                _detailRow('Tenure', '${loan!.decision!.tenureMonths ?? 'N/A'} months'),
                              ],
                            ),
                          ),
                        ),
                      ],

                      // Repayment Schedule
                      if (loan!.schedule.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Repayment Schedule', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                                    if (loan!.status == 'DISBURSED')
                                      ElevatedButton.icon(
                                        onPressed: () => router.go('/payments'),
                                        icon: const Icon(Icons.payment),
                                        label: const Text('Pay EMI'),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: Colors.blue,
                                          foregroundColor: Colors.white,
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                ...loan!.schedule.map((s) => Container(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: (s['paid'] as bool? ?? false) ? Colors.green.shade50 : Colors.grey.shade50,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: (s['paid'] as bool? ?? false) ? Colors.green : Colors.grey,
                                          width: 1,
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Row(
                                                  children: [
                                                    Text('EMI ${s['installmentNo']}',
                                                        style: const TextStyle(fontWeight: FontWeight.bold)),
                                                    const SizedBox(width: 8),
                                                    if (s['paid'] as bool? ?? false)
                                                      const Icon(Icons.check_circle, color: Colors.green, size: 16)
                                                    else
                                                      const Icon(Icons.schedule, color: Colors.orange, size: 16),
                                                  ],
                                                ),
                                                Text('Due: ${DateTime.parse(s['dueDate'] as String).toLocal().toString().split(' ')[0]}',
                                                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                                Text('₹${s['total']} (Principal: ₹${s['principal']}, Interest: ₹${s['interest']})',
                                                    style: const TextStyle(fontSize: 12)),
                                                if (s['paid'] as bool? ?? false)
                                                  Text('Paid on: ${s['paidAt'] != null ? DateTime.parse(s['paidAt'] as String).toLocal().toString().split(' ')[0] : 'N/A'}',
                                                      style: const TextStyle(fontSize: 10, color: Colors.green, fontWeight: FontWeight.w500)),
                                              ],
                                            ),
                                          ),
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.end,
                                            children: [
                                              Text(
                                                '₹${s['total']}',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  color: (s['paid'] as bool? ?? false) ? Colors.green : Colors.black,
                                                ),
                                              ),
                                              if (!(s['paid'] as bool? ?? false))
                                                Text(
                                                  _getDaysUntilDue(DateTime.parse(s['dueDate'] as String)),
                                                  style: const TextStyle(fontSize: 10, color: Colors.red),
                                                ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    )),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 120, child: Text('$label:', style: const TextStyle(fontWeight: FontWeight.w500))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
