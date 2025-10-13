class Ticket {
  final String id, subject, message, status;
  Ticket({required this.id, required this.subject, required this.message, required this.status});
  factory Ticket.fromJson(Map j) => Ticket(id:j['_id'], subject:j['subject']??'', message:j['message']??'', status:j['status']??'OPEN');
}
