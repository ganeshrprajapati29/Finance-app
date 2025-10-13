import axios from 'axios'
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080' })
function getTokens(){ try{ const raw=localStorage.getItem('kp_tokens'); return raw? JSON.parse(raw): null } catch{return null} }
function setTokens(t){ localStorage.setItem('kp_tokens', JSON.stringify(t)) }
api.interceptors.request.use((config)=>{ const t=getTokens(); if(t?.accessToken) config.headers.Authorization = `Bearer ${t.accessToken}`; return config })
let refreshing=null
api.interceptors.response.use(
  (res)=>res,
  async (error)=>{
    const original = error.config
    if (error.response && error.response.status===401 && !original._retry){
      const tk = getTokens()
      if (!tk?.refreshToken) throw error
      if (!refreshing){
        refreshing = axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken: tk.refreshToken })
          .then(r=>{ const accessToken = r.data?.data?.accessToken; if(accessToken){ const updated={...tk, accessToken}; setTokens(updated); return accessToken } throw error })
          .finally(()=> refreshing=null)
      }
      const newAccess = await refreshing
      original._retry = true
      original.headers.Authorization = `Bearer ${newAccess}`
      return api(original)
    }
    throw error
  }
)
export default api
