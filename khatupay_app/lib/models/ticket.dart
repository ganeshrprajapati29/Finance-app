class Ticket {
  final String id, subject, message, status;
  final DateTime? createdAt;
  final String? adminNotes;

  Ticket({
    required this.id,
    required this.subject,
    required this.message,
    required this.status,
    this.createdAt,
    this.adminNotes,
  });

  factory Ticket.fromJson(Map j) => Ticket(
        id: j['_id']?.toString() ?? j['id']?.toString() ?? '',
        subject: j['subject'] ?? '',
        message: j['message'] ?? '',
        status: j['status'] ?? 'OPEN',
        createdAt: j['createdAt'] != null ? DateTime.tryParse(j['createdAt'].toString()) : null,
        adminNotes: j['adminNotes']?.toString(),
      );
}
