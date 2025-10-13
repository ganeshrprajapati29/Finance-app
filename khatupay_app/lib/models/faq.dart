class FAQ {
  final String id, question, answer;
  FAQ({required this.id, required this.question, required this.answer});
  factory FAQ.fromJson(Map j) => FAQ(id: j['_id'], question: j['question'], answer: j['answer']);
}
