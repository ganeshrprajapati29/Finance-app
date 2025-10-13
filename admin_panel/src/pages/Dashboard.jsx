import { useEffect, useState } from 'react'
import { Card, Row, Col } from 'react-bootstrap'
import api from '../api/axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function Dashboard(){
  const [metrics, setMetrics] = useState(null)
  const [series, setSeries] = useState([])

  useEffect(()=>{
    (async()=>{
      const m = await api.get('/admin/metrics'); setMetrics(m.data.data)
      const s = await api.get('/admin/metrics/timeseries?days=30'); setSeries(s.data.data)
    })()
  }, [])

  return (
    <div>
      <Row className="mb-3">
        {metrics && (
          <>
            <Col md={3}><Card className="p-3"><div>Users</div><h3>{metrics.users}</h3></Card></Col>
            <Col md={3}><Card className="p-3"><div>Loans</div><h3>{metrics.loans}</h3></Card></Col>
            <Col md={3}><Card className="p-3"><div>Approved</div><h3>{metrics.approved}</h3></Card></Col>
            <Col md={3}><Card className="p-3"><div>Received ₹</div><h3>{metrics.totalReceived}</h3></Card></Col>
          </>
        )}
      </Row>

      <Row>
        <Col md={6}>
          <Card className="p-3">
            <div className="mb-2">New Users (last 30 days)</div>
            <div style={{ width:'100%', height:300 }}>
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="newUsers" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="p-3">
            <div className="mb-2">Payments Received (₹ per day)</div>
            <div style={{ width:'100%', height:300 }}>
              <ResponsiveContainer>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="receivedAmount" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
