import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Pagination, Row, Table } from 'react-bootstrap';
import { Edit3, Eye, ImagePlus, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import api from '../api/axios';

const categories = ['GENERAL', 'LOAN', 'QR', 'BILL', 'WALLET', 'SHOPPING', 'REFERRAL'];
const placements = ['ALL', 'HOME_BANNER', 'OFFERS_PAGE', 'POPUP', 'LOAN_APPLY'];
const blankForm = {
  title: '',
  subtitle: '',
  description: '',
  imageUrl: '',
  thumbnailUrl: '',
  category: 'GENERAL',
  placement: 'ALL',
  ctaText: 'View Offer',
  ctaUrl: '',
  deepLink: '',
  couponCode: '',
  discountText: '',
  priority: 0,
  isActive: true,
  startAt: '',
  endAt: '',
  terms: ''
};

const unwrap = (res) => res?.data?.data || res?.data || {};
const dateInput = (value) => (value ? new Date(value).toISOString().slice(0, 16) : '');
const dateText = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'Always');
const assetUrl = (value) => {
  if (!value) return '';
  if (String(value).startsWith('http') || String(value).startsWith('data:')) return value;
  return `${api.defaults.baseURL.replace(/\/api\/?$/, '')}${value}`;
};

export default function Offers() {
  const [offers, setOffers] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: 'ALL', category: 'ALL', placement: 'ALL' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(blankForm);
  const limit = 20;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: filters.status,
        category: filters.category,
        placement: filters.placement
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      const res = await api.get(`/admin/offers?${params.toString()}`);
      const data = unwrap(res);
      setOffers(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setActive(Number(data.active || 0));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Offers load nahi hue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [page, filters.status, filters.category, filters.placement]);

  const openModal = (offer = null) => {
    setEditing(offer);
    setForm(offer ? {
      title: offer.title || '',
      subtitle: offer.subtitle || '',
      description: offer.description || '',
      imageUrl: offer.imageUrl || '',
      thumbnailUrl: offer.thumbnailUrl || '',
      category: offer.category || 'GENERAL',
      placement: offer.placement || 'ALL',
      ctaText: offer.ctaText || 'View Offer',
      ctaUrl: offer.ctaUrl || '',
      deepLink: offer.deepLink || '',
      couponCode: offer.couponCode || '',
      discountText: offer.discountText || '',
      priority: offer.priority || 0,
      isActive: offer.isActive !== false,
      startAt: dateInput(offer.startAt),
      endAt: dateInput(offer.endAt),
      terms: Array.isArray(offer.terms) ? offer.terms.join('\n') : ''
    } : blankForm);
    setShowModal(true);
  };

  const uploadImage = async (event, field = 'imageUrl') => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const data = new FormData();
      data.append('file', file);
      const res = await api.post('/upload/single', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      const uploaded = unwrap(res);
      setForm((current) => ({ ...current, [field]: uploaded.url || '' }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Image upload nahi hui');
    } finally {
      setUploading(false);
    }
  };

  const saveOffer = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const payload = { ...form, priority: Number(form.priority || 0) };
      if (editing) await api.put(`/admin/offers/${editing._id}`, payload);
      else await api.post('/admin/offers', payload);
      setShowModal(false);
      setEditing(null);
      setForm(blankForm);
      fetchOffers();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Offer save nahi hua');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (offer) => {
    await api.patch(`/admin/offers/${offer._id}/status`, { isActive: !offer.isActive });
    fetchOffers();
  };

  const deleteOffer = async (offer) => {
    if (!window.confirm(`${offer.title} delete karna hai?`)) return;
    await api.delete(`/admin/offers/${offer._id}`);
    fetchOffers();
  };

  const statusBadge = (offer) => <Badge bg={offer.isActive ? 'success' : 'secondary'}>{offer.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>;

  return (
    <div className="offers-page">
      <div className="offers-head">
        <div>
          <p>Marketing Content</p>
          <h2><ImagePlus size={28} /> Offers & App Banners</h2>
          <span>Add, edit, schedule and publish dynamic image offers across app home and offers pages.</span>
        </div>
        <div className="offers-actions">
          <Button variant="outline-secondary" onClick={fetchOffers}><RefreshCw size={16} /> Refresh</Button>
          <Button onClick={() => openModal()}><Plus size={16} /> Add Offer</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="offers-stat"><span>Total Offers</span><strong>{total}</strong><small>All records</small></Card></Col>
        <Col md={3}><Card className="offers-stat success"><span>Active</span><strong>{active}</strong><small>Visible in app</small></Card></Col>
        <Col md={3}><Card className="offers-stat"><span>Home Banners</span><strong>{offers.filter((o) => ['HOME_BANNER', 'ALL'].includes(o.placement)).length}</strong><small>Current page</small></Card></Col>
        <Col md={3}><Card className="offers-stat"><span>Categories</span><strong>{categories.length}</strong><small>Supported groups</small></Card></Col>
      </Row>

      <Card className="offers-panel mb-3">
        <Row className="g-2">
          <Col xl={4} md={6}>
            <InputGroup>
              <InputGroup.Text><Search size={16} /></InputGroup.Text>
              <Form.Control
                placeholder="Search title, coupon, description..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && fetchOffers()}
              />
            </InputGroup>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}>
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Form.Select>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.category} onChange={(e) => { setPage(1); setFilters({ ...filters, category: e.target.value }); }}>
              <option value="ALL">All Category</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </Form.Select>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.placement} onChange={(e) => { setPage(1); setFilters({ ...filters, placement: e.target.value }); }}>
              <option value="ALL">All Placement</option>
              {placements.filter((p) => p !== 'ALL').map((item) => <option key={item} value={item}>{item}</option>)}
            </Form.Select>
          </Col>
          <Col xl={2} md={6}><Button variant="dark" className="w-100" onClick={fetchOffers}>Apply</Button></Col>
        </Row>
      </Card>

      <Card className="offers-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead>
            <tr>
              <th>Creative</th>
              <th>Offer</th>
              <th>Placement</th>
              <th>Schedule</th>
              <th>Status</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center py-5">Loading offers...</td></tr>
            ) : offers.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-5">No offers found. Add your first app banner.</td></tr>
            ) : offers.map((offer) => (
              <tr key={offer._id}>
                <td>
                  <div className="offer-thumb">
                    {offer.imageUrl ? <img src={assetUrl(offer.imageUrl)} alt={offer.title} /> : <ImagePlus size={28} />}
                  </div>
                </td>
                <td><strong>{offer.title}</strong><small>{offer.discountText || offer.subtitle || offer.couponCode || offer.category}</small></td>
                <td><Badge bg="info">{offer.placement}</Badge> <Badge bg="light" text="dark">{offer.category}</Badge><small>Priority {offer.priority || 0}</small></td>
                <td><small>{dateText(offer.startAt)}<br />{dateText(offer.endAt)}</small></td>
                <td>{statusBadge(offer)}</td>
                <td>
                  <div className="offers-row-actions justify-content-end">
                    <Button size="sm" variant="outline-secondary" onClick={() => setPreview(offer)}><Eye size={14} /></Button>
                    <Button size="sm" variant="outline-primary" onClick={() => openModal(offer)}><Edit3 size={14} /></Button>
                    <Button size="sm" variant={offer.isActive ? 'outline-warning' : 'outline-success'} onClick={() => toggleStatus(offer)}>{offer.isActive ? 'Hide' : 'Show'}</Button>
                    <Button size="sm" variant="outline-danger" onClick={() => deleteOffer(offer)}><Trash2 size={14} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <Pagination className="justify-content-center mt-3">
          <Pagination.Prev disabled={page === 1} onClick={() => setPage(page - 1)} />
          {[...Array(Math.min(5, totalPages))].map((_, index) => {
            const number = Math.max(1, Math.min(totalPages - 4, page - 2)) + index;
            if (number > totalPages) return null;
            return <Pagination.Item key={number} active={page === number} onClick={() => setPage(number)}>{number}</Pagination.Item>;
          })}
          <Pagination.Next disabled={page === totalPages} onClick={() => setPage(page + 1)} />
        </Pagination>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl">
        <Form onSubmit={saveOffer}>
          <Modal.Header closeButton><Modal.Title>{editing ? 'Edit Offer' : 'Add Offer'}</Modal.Title></Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col lg={7}>
                <Row className="g-3">
                  <Col md={8}><Form.Label>Title</Form.Label><Form.Control value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Col>
                  <Col md={4}><Form.Label>Discount Text</Form.Label><Form.Control value={form.discountText} onChange={(e) => setForm({ ...form, discountText: e.target.value })} placeholder="50% OFF" /></Col>
                  <Col md={12}><Form.Label>Subtitle</Form.Label><Form.Control value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></Col>
                  <Col md={12}><Form.Label>Description</Form.Label><Form.Control as="textarea" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Col>
                  <Col md={4}><Form.Label>Category</Form.Label><Form.Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</Form.Select></Col>
                  <Col md={4}><Form.Label>Placement</Form.Label><Form.Select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>{placements.map((item) => <option key={item} value={item}>{item}</option>)}</Form.Select></Col>
                  <Col md={4}><Form.Label>Priority</Form.Label><Form.Control type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></Col>
                  <Col md={4}><Form.Label>CTA Text</Form.Label><Form.Control value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} /></Col>
                  <Col md={4}><Form.Label>Deep Link</Form.Label><Form.Control value={form.deepLink} onChange={(e) => setForm({ ...form, deepLink: e.target.value })} placeholder="/payments" /></Col>
                  <Col md={4}><Form.Label>Coupon Code</Form.Label><Form.Control value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value })} /></Col>
                  <Col md={12}><Form.Label>CTA URL</Form.Label><Form.Control value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} placeholder="https://..." /></Col>
                  <Col md={6}><Form.Label>Start Date</Form.Label><Form.Control type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></Col>
                  <Col md={6}><Form.Label>End Date</Form.Label><Form.Control type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></Col>
                  <Col md={12}><Form.Label>Terms</Form.Label><Form.Control as="textarea" rows={3} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="One term per line" /></Col>
                  <Col md={12}><Form.Check type="switch" label="Active in app" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /></Col>
                </Row>
              </Col>
              <Col lg={5}>
                <Form.Label>Banner Image</Form.Label>
                <InputGroup>
                  <Form.Control value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="/uploads/banner.png or https://..." />
                  <Button variant="outline-secondary" as="label">
                    <Upload size={16} /> Upload
                    <input type="file" accept="image/*" hidden onChange={(e) => uploadImage(e, 'imageUrl')} />
                  </Button>
                </InputGroup>
                {uploading && <small className="text-muted">Uploading image...</small>}
                <div className="offer-preview mt-3">
                  {form.imageUrl ? <img src={assetUrl(form.imageUrl)} alt="Offer preview" /> : <ImagePlus size={80} />}
                  <div className="offer-preview-copy">
                    {form.discountText && <b>{form.discountText}</b>}
                    <strong>{form.title || 'Offer title'}</strong>
                    <span>{form.subtitle || 'Offer subtitle preview'}</span>
                  </div>
                </div>
                <Form.Label className="mt-3">Thumbnail URL</Form.Label>
                <Form.Control value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Offer'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={!!preview} onHide={() => setPreview(null)} size="lg">
        <Modal.Header closeButton><Modal.Title>{preview?.title}</Modal.Title></Modal.Header>
        <Modal.Body>
          {preview && (
            <div className="offer-public-preview">
              {preview.imageUrl ? <img src={assetUrl(preview.imageUrl)} alt={preview.title} /> : <ImagePlus size={90} />}
              <h3>{preview.title}</h3>
              <p>{preview.subtitle}</p>
              {preview.couponCode && <code>{preview.couponCode}</code>}
              <span>{preview.description}</span>
            </div>
          )}
        </Modal.Body>
      </Modal>

      <style>{`
        .offers-page { padding: 8px 0 24px; }
        .offers-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px; }
        .offers-head p { margin:0 0 4px; color:#0f766e; font-size:12px; font-weight:900; text-transform:uppercase; }
        .offers-head h2 { display:flex; align-items:center; gap:10px; margin:0; font-weight:850; color:#111827; }
        .offers-head span { color:#64748b; }
        .offers-actions, .offers-row-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .offers-actions .btn, .offers-row-actions .btn { display:inline-flex; align-items:center; gap:6px; }
        .offers-stat, .offers-panel, .offers-table-card { border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 10px 26px rgba(15,23,42,.06); }
        .offers-stat { padding:16px; }
        .offers-stat span, .offers-stat small, .offers-table-card td small { display:block; color:#64748b; font-weight:800; }
        .offers-stat strong { display:block; font-size:24px; margin:4px 0; color:#111827; }
        .offers-stat.success strong { color:#047857; }
        .offers-panel { padding:16px; }
        .offers-table-card { overflow:hidden; }
        .offers-table-card thead th { background:#f8fafc; color:#475569; font-size:12px; text-transform:uppercase; }
        .offer-thumb { width:96px; height:54px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; display:grid; place-items:center; background:#f8fafc; }
        .offer-thumb img { width:100%; height:100%; object-fit:cover; }
        .offer-preview { height:260px; border-radius:8px; overflow:hidden; background:#0f766e; position:relative; display:grid; place-items:center; color:white; }
        .offer-preview img { width:100%; height:100%; object-fit:cover; position:absolute; inset:0; }
        .offer-preview:after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,.08)); }
        .offer-preview-copy { position:relative; z-index:2; padding:22px; width:100%; display:flex; flex-direction:column; align-items:flex-start; gap:8px; }
        .offer-preview-copy b { color:#92400e; background:#fffbeb; border-radius:99px; padding:6px 10px; font-size:12px; }
        .offer-preview-copy strong { font-size:28px; max-width:78%; }
        .offer-preview-copy span { color:rgba(255,255,255,.82); font-weight:700; }
        .offer-public-preview img { width:100%; max-height:340px; object-fit:cover; border-radius:8px; margin-bottom:16px; }
        .offer-public-preview code { display:inline-block; padding:8px 12px; background:#fffbeb; color:#92400e; border-radius:8px; margin-bottom:12px; }
        .offer-public-preview span { display:block; color:#475569; }
        @media(max-width:768px){ .offers-head{flex-direction:column;} .offers-actions .btn{flex:1; justify-content:center;} }
      `}</style>
    </div>
  );
}
