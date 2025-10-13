import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../models/loan_application.dart';
import '../../services/user_service.dart';
import '../../services/loan_service.dart';
import '../../routes/app_router.dart';

class LoanApplyWizardPage extends StatefulWidget {
  const LoanApplyWizardPage({super.key});
  @override State<LoanApplyWizardPage> createState() => _S();
}

class _S extends State<LoanApplyWizardPage> {
  final _pg = PageController();
  int _step = 0;
  final draft = LoanApplicationDraft();
  final _formKeys = List.generate(5, (_) => GlobalKey<FormState>());

  // Controllers (Step 1)
  final nameC = TextEditingController(), emailC = TextEditingController(),
        mobileC = TextEditingController(), addrC = TextEditingController(),
        fatherC = TextEditingController(), motherC = TextEditingController();

  // Step 2
  final eduC = TextEditingController(), streamC = TextEditingController(), instC = TextEditingController();

  // Step 3
  final empTypeC = TextEditingController(text: 'Salaried');
  final incomeC = TextEditingController(text: '0');
  final employerC = TextEditingController();
  final expC = TextEditingController(text: '0');

  // Step 5 references (3 rows)
  final r1n = TextEditingController(), r1r = TextEditingController(), r1m = TextEditingController();
  final r2n = TextEditingController(), r2r = TextEditingController(), r2m = TextEditingController();
  final r3n = TextEditingController(), r3r = TextEditingController(), r3m = TextEditingController();

  // Amount & tenure
  final amountC = TextEditingController(text: '10000');
  final tenureC = TextEditingController(text: '12');
  final purposeC = TextEditingController(text: 'Personal');

  // Doc local paths
  String afPath='', abPath='', panPath='', selfiePath='';
  bool uploading=false, submitting=false;

  Future<void> _pick(bool camera, void Function(String) setPath) async {
    final ImagePicker picker = ImagePicker();
    final XFile? x = camera
        ? await picker.pickImage(source: ImageSource.camera, imageQuality: 75)
        : await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (x != null) setState(()=> setPath(x.path));
  }

  Future<void> _uploadDocs() async {
    if ([afPath, abPath, panPath, selfiePath].where((p)=>p.isNotEmpty).isEmpty) return;
    setState(()=>uploading=true);
    try {
      final paths = [afPath, abPath, panPath, selfiePath].where((p)=>p.isNotEmpty).toList();
      // Upload via existing KYC endpoint -> returns nothing, but files are saved on server
      await UserService().uploadKyc(paths);
      // In real impl, backend should return uploaded URLs; for now, assume /uploads/<filename>
      draft.aadhaarFrontUrl = afPath.isNotEmpty ? '/uploads/${File(afPath).uri.pathSegments.last}' : null;
      draft.aadhaarBackUrl  = abPath.isNotEmpty ? '/uploads/${File(abPath).uri.pathSegments.last}' : null;
      draft.panUrl          = panPath.isNotEmpty ? '/uploads/${File(panPath).uri.pathSegments.last}' : null;
      draft.selfieUrl       = selfiePath.isNotEmpty ? '/uploads/${File(selfiePath).uri.pathSegments.last}' : null;
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Documents uploaded')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
    } finally { if (mounted) setState(()=>uploading=false); }
  }

  void _next() {
    if (_formKeys[_step].currentState?.validate() != true) return;
    if (_step<4){ setState(()=>_step++); _pg.nextPage(duration: const Duration(milliseconds:300), curve: Curves.easeInOut); }
  }
  void _back(){
    if (_step>0){ setState(()=>_step--); _pg.previousPage(duration: const Duration(milliseconds:300), curve: Curves.easeInOut); }
  }

  Future<void> _submit() async {
    if (_formKeys[4].currentState?.validate() != true) return;
    // bind draft
    draft
      ..name = nameC.text.trim()
      ..email = emailC.text.trim()
      ..mobile = mobileC.text.trim()
      ..address = addrC.text.trim()
      ..fatherName = fatherC.text.trim()
      ..motherName = motherC.text.trim()
      ..highestEducation = eduC.text.trim()
      ..stream = streamC.text.trim()
      ..institution = instC.text.trim()
      ..employmentType = empTypeC.text.trim()
      ..monthlyIncome = num.tryParse(incomeC.text.trim()) ?? 0
      ..employerOrBusiness = employerC.text.trim()
      ..experienceYears = int.tryParse(expC.text.trim()) ?? 0
      ..aadhaarFrontPath = afPath
      ..aadhaarBackPath = abPath
      ..panPath = panPath
      ..selfiePath = selfiePath
      ..amountRequested = num.tryParse(amountC.text.trim()) ?? 0
      ..tenureMonths = int.tryParse(tenureC.text.trim()) ?? 12
      ..purpose = purposeC.text.trim()
      ..references = [
        LoanReference(name: r1n.text, relation: r1r.text, mobile: r1m.text),
        LoanReference(name: r2n.text, relation: r2r.text, mobile: r2m.text),
        LoanReference(name: r3n.text, relation: r3r.text, mobile: r3m.text),
      ];

    setState(()=>submitting=true);
    try {
      await _uploadDocs(); // ensure docs uploaded (sets URLs)
      final id = await LoanService().applyDraft(draft);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Loan request submitted (#$id)')));
      router.go('/loans'); // go to history
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Submit failed: $e')));
    } finally { if (mounted) setState(()=>submitting=false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Apply Loan')),
      body: Column(
        children: [
          LinearProgressIndicator(value: (_step+1)/5),
          Expanded(
            child: PageView(
              controller: _pg, physics: const NeverScrollableScrollPhysics(),
              children: [
                _stepPersonal(), _stepQualification(), _stepEmployment(), _stepDocs(), _stepReferences(),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: Row(
              children: [
                if (_step>0) OutlinedButton(onPressed: _back, child: const Text('Back')),
                const Spacer(),
                if (_step<4) ElevatedButton(onPressed: _next, child: const Text('Next')),
                if (_step==4) ElevatedButton(onPressed: submitting? null: _submit, child: Text(submitting?'Submitting...':'Submit')),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _stepPersonal(){
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16), child: Form(key:_formKeys[0], child: Column(children: [
        _f(nameC, 'Full Name', req:true),
        _f(emailC, 'Email', req:true, email:true),
        _f(mobileC, 'Mobile', req:true),
        _f(addrC, 'Address', req:true),
        _f(fatherC, 'Father Name', req:true),
        _f(motherC, 'Mother Name', req:true),
        const SizedBox(height: 8),
        Row(children:[Expanded(child:_f(amountC,'Amount (₹)', req:true, number:true)), const SizedBox(width:8), Expanded(child:_f(tenureC,'Tenure (months)', req:true, number:true))]),
        _f(purposeC, 'Purpose', req:true),
      ])),
    );
  }

  Widget _stepQualification(){
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16), child: Form(key:_formKeys[1], child: Column(children: [
        _f(eduC, 'Highest Education (10th/12th/Graduate/PG/Other)', req:true),
        _f(streamC, 'Stream/Discipline'),
        _f(instC, 'Institution/College'),
      ])),
    );
  }

  Widget _stepEmployment(){
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16), child: Form(key:_formKeys[2], child: Column(children: [
        _f(empTypeC, 'Employment Type (Salaried/Self/Student/Housewife/Unemployed)', req:true),
        _f(incomeC, 'Monthly Income (₹)', number:true),
        _f(employerC, 'Employer/Business Name'),
        _f(expC, 'Experience (years)', number:true),
      ])),
    );
  }

  Widget _docRow(String label, String path, void Function() onCam, void Function() onGallery){
    return Card(child: ListTile(
      title: Text(label),
      subtitle: Text(path.isEmpty? 'Not selected' : path),
      trailing: Wrap(spacing:8, children: [
        IconButton(onPressed:onCam, icon: const Icon(Icons.camera_alt)),
        IconButton(onPressed:onGallery, icon: const Icon(Icons.photo_library)),
      ]),
    ));
  }

  Widget _stepDocs(){
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16), child: Form(key:_formKeys[3], child: Column(children: [
        _docRow('Aadhaar Front', afPath, ()=>_pick(true, (p)=>afPath=p), ()=>_pick(false,(p)=>afPath=p)),
        _docRow('Aadhaar Back',  abPath, ()=>_pick(true, (p)=>abPath=p), ()=>_pick(false,(p)=>abPath=p)),
        _docRow('PAN',           panPath, ()=>_pick(true, (p)=>panPath=p), ()=>_pick(false,(p)=>panPath=p)),
        _docRow('Live Selfie',   selfiePath, ()=>_pick(true, (p)=>selfiePath=p), ()=>_pick(false,(p)=>selfiePath=p)),
        const SizedBox(height:10),
        ElevatedButton(onPressed: uploading? null: _uploadDocs, child: Text(uploading? 'Uploading...':'Upload Documents Now')),
      ])),
    );
  }

  Widget _stepReferences(){
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16), child: Form(key:_formKeys[4], child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('At least 3 references required', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height:8),
        _refBlock('Reference 1', r1n, r1r, r1m),
        _refBlock('Reference 2', r2n, r2r, r2m),
        _refBlock('Reference 3', r3n, r3r, r3m),
      ])),
    );
  }

  Widget _refBlock(String title, TextEditingController n, TextEditingController r, TextEditingController m){
    return Card(child: Padding(
      padding: const EdgeInsets.all(12), child: Column(children: [
        Align(alignment: Alignment.centerLeft, child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600))),
        const SizedBox(height:6),
        _f(n, 'Name', req:true),
        _f(r, 'Relation', req:true),
        _f(m, 'Mobile', req:true),
      ]),
    ));
  }

  Widget _f(TextEditingController c, String hint, {bool req=false, bool email=false, bool number=false}){
    String? v(String? x){
      if (req && (x==null || x.trim().isEmpty)) return 'Required';
      if (email && x!=null && x.isNotEmpty && !x.contains('@')) return 'Invalid email';
      if (number && x!=null && x.isNotEmpty && num.tryParse(x)==null) return 'Enter number';
      return null;
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextFormField(controller: c, validator: v,
        keyboardType: number? TextInputType.number : (email? TextInputType.emailAddress : TextInputType.text),
        decoration: InputDecoration(labelText: hint, border: const OutlineInputBorder()),
      ),
    );
  }
}
