import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';
import '../../models/loan_application.dart';
import '../../services/user_service.dart';
import '../../services/loan_service.dart';
import '../../routes/app_router.dart';
import '../../core/api_client.dart';
import '../../core/auth_storage.dart';
import '../../core/config.dart';

class LoanApplyWizardPage extends StatefulWidget {
  const LoanApplyWizardPage({super.key});
  @override State<LoanApplyWizardPage> createState() => _S();
}

class _S extends State<LoanApplyWizardPage> {
  final _pg = PageController();
  int _step = 0;
  final draft = LoanApplicationDraft();
  final _formKeys = List.generate(6, (_) => GlobalKey<FormState>());

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

  // Step 6 bank details
  final bankNameC = TextEditingController(), accountNumberC = TextEditingController(),
        ifscCodeC = TextEditingController(), accountHolderNameC = TextEditingController();

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
      // Upload via Cloudinary endpoint
      final dio = Dio(BaseOptions(baseUrl: AppConfig.baseUrl));
      final response = await dio.post(
        '/upload/cloudinary/many',
        data: FormData.fromMap({
          'files': paths.map((path) => MultipartFile.fromFileSync(path)).toList(),
        }),
        options: Options(headers: {'Authorization': 'Bearer ${await AuthStorage.getAccessToken()}'}),
      );

      if (response.data['success'] == true) {
        final uploadedUrls = response.data['data'] as List;
        // Map URLs back to draft based on order
        int urlIndex = 0;
        if (afPath.isNotEmpty) draft.aadhaarFrontUrl = uploadedUrls[urlIndex++]['url'];
        if (abPath.isNotEmpty) draft.aadhaarBackUrl = uploadedUrls[urlIndex++]['url'];
        if (panPath.isNotEmpty) draft.panUrl = uploadedUrls[urlIndex++]['url'];
        if (selfiePath.isNotEmpty) draft.selfieUrl = uploadedUrls[urlIndex++]['url'];
      }

      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Documents uploaded to Cloudinary')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
    } finally { if (mounted) setState(()=>uploading=false); }
  }

  void _next() {
    if (_formKeys[_step].currentState?.validate() != true) return;
    if (_step<5){ setState(()=>_step++); _pg.nextPage(duration: const Duration(milliseconds:300), curve: Curves.easeInOut); }
  }
  void _back(){
    if (_step>0){ setState(()=>_step--); _pg.previousPage(duration: const Duration(milliseconds:300), curve: Curves.easeInOut); }
  }

  Future<void> _submit() async {
    if (_formKeys[5].currentState?.validate() != true) return;
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
      ]
      ..bankName = bankNameC.text.trim()
      ..accountNumber = accountNumberC.text.trim()
      ..ifscCode = ifscCodeC.text.trim()
      ..accountHolderName = accountHolderNameC.text.trim();

    setState(()=>submitting=true);
    try {
      await _uploadDocs(); // ensure docs uploaded (sets URLs)
      final id = await LoanService().applyDraft(draft);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Loan request submitted (#$id)')));
      router.go('/apply-success/$id'); // go to success page
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Submit failed: $e')));
    } finally { if (mounted) setState(()=>submitting=false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: Text(
          'Loan Application Wizard',
          style: TextStyle(color: Colors.black, fontSize: 18.sp),
        ),
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: Column(
        children: [
          Container(
            padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
            child: Column(
              children: [
                LinearProgressIndicator(
                  value: (_step + 1) / 6,
                  backgroundColor: Colors.grey.shade300,
                  valueColor: const AlwaysStoppedAnimation<Color>(Colors.blueAccent),
                ),
                SizedBox(height: 8.h),
                Text(
                  'Step ${_step + 1} of 6',
                  style: TextStyle(
                    fontSize: 14.sp,
                    color: Colors.blueAccent,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: PageView(
              controller: _pg,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _stepPersonal(),
                _stepQualification(),
                _stepEmployment(),
                _stepDocs(),
                _stepReferences(),
                _stepBankDetails(),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.all(16.w),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Colors.grey.shade200)),
            ),
            child: Row(
              children: [
                if (_step > 0)
                  OutlinedButton(
                    onPressed: _back,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.blueAccent),
                      foregroundColor: Colors.blueAccent,
                      padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 12.h),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8.r),
                      ),
                    ),
                    child: Text(
                      'Back',
                      style: TextStyle(fontSize: 14.sp),
                    ),
                  ),
                const Spacer(),
                if (_step < 5)
                  ElevatedButton(
                    onPressed: _next,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blueAccent,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 12.h),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8.r),
                      ),
                    ),
                    child: Text(
                      'Next',
                      style: TextStyle(fontSize: 14.sp),
                    ),
                  ),
                if (_step == 5)
                  ElevatedButton(
                    onPressed: submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 12.h),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8.r),
                      ),
                    ),
                    child: Text(
                      submitting ? 'Submitting...' : 'Submit Application',
                      style: TextStyle(fontSize: 14.sp),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _stepPersonal(){
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w), child: Form(key:_formKeys[0], child: Column(children: [
        Text(
          'Personal Information',
          style: TextStyle(
            fontSize: 20.sp,
            fontWeight: FontWeight.bold,
            color: Colors.blueAccent,
          ),
        ),
        SizedBox(height: 16.h),
        _f(nameC, 'Full Name', req:true),
        _f(emailC, 'Email', req:true, email:true),
        _f(mobileC, 'Mobile', req:true),
        _f(addrC, 'Address', req:true),
        _f(fatherC, 'Father Name', req:true),
        _f(motherC, 'Mother Name', req:true),
        SizedBox(height: 16.h),
        Text(
          'Loan Details',
          style: TextStyle(
            fontSize: 18.sp,
            fontWeight: FontWeight.w600,
            color: Colors.blueAccent,
          ),
        ),
        SizedBox(height: 8.h),
        Row(children:[Expanded(child:_f(amountC,'Amount (₹)', req:true, number:true)), SizedBox(width:8.w), Expanded(child:_f(tenureC,'Tenure (months)', req:true, number:true))]),
        _f(purposeC, 'Purpose', req:true),
        SizedBox(height: 16.h),
        Text(
          'Identification',
          style: TextStyle(
            fontSize: 18.sp,
            fontWeight: FontWeight.w600,
            color: Colors.blueAccent,
          ),
        ),
        SizedBox(height: 8.h),
        _f(TextEditingController(), 'Aadhaar Number', req:true, number:true), // Placeholder, not saved
        _f(TextEditingController(), 'PAN Number', req:true), // Placeholder, not saved
      ])),
    );
  }

  Widget _stepQualification(){
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w), child: Form(key:_formKeys[1], child: Column(children: [
        Text(
          'Educational Qualification',
          style: TextStyle(
            fontSize: 20.sp,
            fontWeight: FontWeight.bold,
            color: Colors.blueAccent,
          ),
        ),
        SizedBox(height: 16.h),
        _f(eduC, 'Highest Education (10th/12th/Graduate/PG/Other)', req:true),
        _f(streamC, 'Stream/Discipline'),
        _f(instC, 'Institution/College'),
      ])),
    );
  }

  Widget _stepEmployment(){
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w), child: Form(key:_formKeys[2], child: Column(children: [
        Text(
          'Employment Details',
          style: TextStyle(
            fontSize: 20.sp,
            fontWeight: FontWeight.bold,
            color: Colors.blueAccent,
          ),
        ),
        SizedBox(height: 16.h),
        _f(empTypeC, 'Employment Type (Salaried/Self/Student/Housewife/Unemployed)', req:true),
        _f(incomeC, 'Monthly Income (₹)', number:true),
        _f(employerC, 'Employer/Business Name'),
        _f(expC, 'Experience (years)', number:true),
      ])),
    );
  }

  Widget _docRow(String label, String path, void Function() onCam, void Function() onGallery){
    return Card(
      color: Colors.white,
      elevation: 2,
      margin: EdgeInsets.only(bottom: 12.h),
      child: ListTile(
        title: Text(
          label,
          style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w500),
        ),
        subtitle: Text(
          path.isEmpty ? 'Not selected' : path.split('/').last,
          style: TextStyle(fontSize: 12.sp, color: Colors.grey),
        ),
        trailing: Wrap(
          spacing: 8.w,
          children: [
            IconButton(
              onPressed: onCam,
              icon: Icon(Icons.camera_alt, color: Colors.blueAccent, size: 24.sp),
            ),
            IconButton(
              onPressed: onGallery,
              icon: Icon(Icons.photo_library, color: Colors.green, size: 24.sp),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepDocs(){
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w), child: Form(key:_formKeys[3], child: Column(children: [
        Text(
          'Document Upload',
          style: TextStyle(
            fontSize: 20.sp,
            fontWeight: FontWeight.bold,
            color: Colors.blueAccent,
          ),
        ),
        SizedBox(height: 8.h),
        Text(
          'Please upload clear photos of your documents',
          style: TextStyle(
            fontSize: 14.sp,
            color: Colors.grey,
          ),
        ),
        SizedBox(height: 16.h),
        _docRow('Aadhaar Front', afPath, ()=>_pick(true, (p)=>afPath=p), ()=>_pick(false,(p)=>afPath=p)),
        _docRow('Aadhaar Back',  abPath, ()=>_pick(true, (p)=>abPath=p), ()=>_pick(false,(p)=>abPath=p)),
        _docRow('PAN',           panPath, ()=>_pick(true, (p)=>panPath=p), ()=>_pick(false,(p)=>panPath=p)),
        _docRow('Live Selfie',   selfiePath, ()=>_pick(true, (p)=>selfiePath=p), ()=>_pick(false,(p)=>selfiePath=p)),
        SizedBox(height: 16.h),
        ElevatedButton(
          onPressed: uploading ? null : _uploadDocs,
          style: ElevatedButton.styleFrom(
            minimumSize: Size(double.infinity, 48.h),
            backgroundColor: Colors.blueAccent,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8.r),
            ),
          ),
          child: Text(
            uploading ? 'Uploading...' : 'Upload Documents Now',
            style: TextStyle(fontSize: 16.sp),
          ),
        ),
      ])),
    );
  }

  Widget _stepReferences(){
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w), child: Form(key:_formKeys[4], child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(
          'References',
          style: TextStyle(
            fontSize: 20.sp,
            fontWeight: FontWeight.bold,
            color: Colors.blueAccent,
          ),
        ),
        SizedBox(height: 8.h),
        Text(
          'At least 3 references required',
          style: TextStyle(
            fontSize: 14.sp,
            color: Colors.grey,
            fontWeight: FontWeight.w500,
          ),
        ),
        SizedBox(height: 16.h),
        _refBlock('Reference 1', r1n, r1r, r1m),
        _refBlock('Reference 2', r2n, r2r, r2m),
        _refBlock('Reference 3', r3n, r3r, r3m),
      ])),
    );
  }

  Widget _refBlock(String title, TextEditingController n, TextEditingController r, TextEditingController m){
    return Card(
      color: Colors.white,
      elevation: 2,
      margin: EdgeInsets.only(bottom: 12.h),
      child: Padding(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 16.sp,
                fontWeight: FontWeight.w600,
                color: Colors.blueAccent,
              ),
            ),
            SizedBox(height: 12.h),
            _f(n, 'Name', req:true),
            _f(r, 'Relation', req:true),
            _f(m, 'Mobile', req:true),
          ],
        ),
      ),
    );
  }

  Widget _stepBankDetails(){
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w), child: Form(key:_formKeys[5], child: Column(children: [
        Text(
          'Bank Details',
          style: TextStyle(
            fontSize: 20.sp,
            fontWeight: FontWeight.bold,
            color: Colors.blueAccent,
          ),
        ),
        SizedBox(height: 8.h),
        Text(
          'Provide your bank account details for loan disbursement',
          style: TextStyle(
            fontSize: 14.sp,
            color: Colors.grey,
          ),
        ),
        SizedBox(height: 16.h),
        _f(bankNameC, 'Bank Name', req:true),
        _f(accountNumberC, 'Account Number', req:true, number:true),
        _f(ifscCodeC, 'IFSC Code', req:true),
        _f(accountHolderNameC, 'Account Holder Name', req:true),
      ])),
    );
  }

  Widget _f(TextEditingController c, String hint, {bool req=false, bool email=false, bool number=false}){
    String? v(String? x){
      if (req && (x==null || x.trim().isEmpty)) return 'Required';
      if (email && x!=null && x.isNotEmpty && !x.contains('@')) return 'Invalid email';
      if (number && x!=null && x.isNotEmpty && num.tryParse(x)==null) return 'Enter number';
      return null;
    }
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: TextFormField(
        controller: c,
        validator: v,
        keyboardType: number? TextInputType.number : (email? TextInputType.emailAddress : TextInputType.text),
        decoration: InputDecoration(
          labelText: hint,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8.r),
          ),
          focusedBorder: OutlineInputBorder(
            borderSide: BorderSide(color: Colors.blueAccent),
            borderRadius: BorderRadius.circular(8.r),
          ),
          contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
        ),
        style: TextStyle(fontSize: 14.sp),
      ),
    );
  }
}
