export function loadRazorpay(){
  return new Promise((resolve, reject)=>{
    if (window.Razorpay) return resolve()
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = ()=> resolve()
    s.onerror = ()=> reject(new Error('Failed to load Razorpay'))
    document.body.appendChild(s)
  })
}
