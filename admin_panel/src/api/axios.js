import axios from 'axios'
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://khatupay.com/api',
})
export function getTokens(){
  try {
    const raw = localStorage.getItem('kp_tokens')
    if (!raw) return null

    let stored
    try { stored = JSON.parse(raw) } catch { stored = raw }

    if (typeof stored === 'string') return { accessToken: stored }
    if (!stored || typeof stored !== 'object') return null

    const source = stored.data && typeof stored.data === 'object' ? stored.data : stored
    const accessToken = source.accessToken || source.token || source.access_token
    const refreshToken = source.refreshToken || source.refresh_token
    return accessToken ? { ...source, accessToken, refreshToken } : null
  } catch {
    return null
  }
}
function setTokens(t){ localStorage.setItem('kp_tokens', JSON.stringify(t)) }
function getEmployeeTokens(){ try{ const raw=localStorage.getItem('kp_employee_tokens'); return raw? JSON.parse(raw): null } catch{return null} }
function setEmployeeTokens(t){ localStorage.setItem('kp_employee_tokens', JSON.stringify(t)) }
function getUserTokens(){ try{ const raw=localStorage.getItem('kp_user_tokens'); return raw? JSON.parse(raw): null } catch{return null} }
function isPortalRoute(basePath){
  if(typeof window==='undefined') return false
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return path === basePath || path.startsWith(`${basePath}/`)
}
function endAdminSession(message='Your session has expired. Please sign in again.'){
  localStorage.removeItem('kp_tokens')
  sessionStorage.setItem('kp_auth_message', message)
  if(typeof window!=='undefined' && window.location.pathname!=='/login') window.location.assign('/login')
}
api.interceptors.request.use((config)=>{
  const t=getTokens();
  const et=getEmployeeTokens();
  const ut=getUserTokens();
  const isEmployeeRoute = isPortalRoute('/employee');
  const isUserRoute = isPortalRoute('/user');
  if(isEmployeeRoute && et?.accessToken) config.headers.Authorization = `Bearer ${et.accessToken}`;
  else if(isUserRoute && ut?.accessToken) config.headers.Authorization = `Bearer ${ut.accessToken}`;
  else if(t?.accessToken) config.headers.Authorization = `Bearer ${t.accessToken}`;
  else if(et?.accessToken) config.headers.Authorization = `Bearer ${et.accessToken}`;
  else if(ut?.accessToken) config.headers.Authorization = `Bearer ${ut.accessToken}`;
  return config
})
let refreshing=null
let employeeRefreshing=null
api.interceptors.response.use(
  (res)=>res,
  async (error)=>{
    const original = error.config
    if (error.response && error.response.status===401 && !original._retry){
      const tk = getTokens()
      const etk = getEmployeeTokens()
      const isEmployeeRoute = isPortalRoute('/employee');
      if (!isEmployeeRoute && tk?.refreshToken){
        if (!refreshing){
          refreshing = axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken: tk.refreshToken })
            .then(r=>{ const accessToken = r.data?.data?.accessToken; if(accessToken){ const updated={...tk, accessToken}; setTokens(updated); return accessToken } throw error })
            .finally(()=> refreshing=null)
        }
        try {
          const newAccess = await refreshing
          original._retry = true
          original.headers.Authorization = `Bearer ${newAccess}`
          return api(original)
        } catch (refreshError) {
          endAdminSession()
          throw refreshError
        }
      } else if (etk?.refreshToken){
        if (!employeeRefreshing){
          employeeRefreshing = axios.post(`${api.defaults.baseURL}/employee/auth/refresh`, { refreshToken: etk.refreshToken })
            .then(r=>{ const accessToken = r.data?.data?.accessToken; if(accessToken){ const updated={...etk, accessToken}; setEmployeeTokens(updated); return accessToken } throw error })
            .finally(()=> employeeRefreshing=null)
        }
        const newAccess = await employeeRefreshing
        original._retry = true
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      }
      endAdminSession()
      throw error
    }
    if(error.response?.status===403 && error.response?.data?.code==='ACCOUNT_BLOCKED'){
      endAdminSession('This account is blocked. Please contact Khatu Pay support.')
    }
    throw error
  }
)
export default api
