import React, { useEffect, useMemo, useState } from 'react';
import { Accordion, Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row } from 'react-bootstrap';
import { HelpCircle, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import api from '../api/axios';

const blankFaq = { question: '', answer: '', category: '', order: 0, active: true };
const unwrap = (res) => res?.data?.data || res?.data || [];

const FAQs = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [formData, setFormData] = useState(blankFaq);

  const fetchFaqs = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/faq');
      const data = unwrap(res);
      setFaqs(Array.isArray(data) ? data : []);
    } catch (err) {
      setFaqs([]);
      setError(err.response?.data?.message || err.message || 'FAQ load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaqs();
  }, []);

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((faq) =>
      faq.question?.toLowerCase().includes(q) ||
      faq.answer?.toLowerCase().includes(q) ||
      faq.category?.toLowerCase().includes(q)
    );
  }, [faqs, search]);

  const groupedFaqs = filteredFaqs.reduce((acc, faq) => {
    const category = faq.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(faq);
    return acc;
  }, {});

  const openModal = (faq = null) => {
    setEditingFaq(faq);
    setFormData(faq ? {
      question: faq.question || '',
      answer: faq.answer || '',
      category: faq.category || '',
      order: faq.order || 0,
      active: faq.active !== false
    } : blankFaq);
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      if (editingFaq) await api.put(`/faq/${editingFaq._id}`, formData);
      else await api.post('/faq', formData);
      setShowModal(false);
      setEditingFaq(null);
      setFormData(blankFaq);
      fetchFaqs();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'FAQ save nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('FAQ delete karna hai?')) return;
    await api.delete(`/faq/${id}`);
    fetchFaqs();
  };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-start mb-4 gap-3">
        <div>
          <p className="text-uppercase text-primary fw-bold mb-1 small">Content Management</p>
          <h2 className="d-flex align-items-center gap-2 mb-1"><HelpCircle size={28} /> FAQs</h2>
          <p className="text-muted mb-0">Create, edit and publish support FAQs for users.</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={fetchFaqs}><RefreshCw size={16} /> Refresh</Button>
          <Button onClick={() => openModal()}><Plus size={16} /> Add FAQ</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Total FAQs</small><h3>{faqs.length}</h3></Card></Col>
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Active</small><h3>{faqs.filter((faq) => faq.active !== false).length}</h3></Card></Col>
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Inactive</small><h3>{faqs.filter((faq) => faq.active === false).length}</h3></Card></Col>
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Categories</small><h3>{Object.keys(groupedFaqs).length}</h3></Card></Col>
      </Row>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <InputGroup>
            <InputGroup.Text><Search size={16} /></InputGroup.Text>
            <Form.Control placeholder="Search FAQs..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </InputGroup>
        </Card.Body>
      </Card>

      {loading ? (
        <Card className="border-0 shadow-sm"><Card.Body className="text-center py-5">Loading FAQs...</Card.Body></Card>
      ) : Object.keys(groupedFaqs).length === 0 ? (
        <Card className="border-0 shadow-sm"><Card.Body className="text-center py-5">No FAQs found.</Card.Body></Card>
      ) : Object.entries(groupedFaqs).map(([category, rows]) => (
        <Card className="border-0 shadow-sm mb-3" key={category}>
          <Card.Header className="bg-white d-flex justify-content-between align-items-center">
            <strong>{category}</strong>
            <Badge bg="secondary">{rows.length}</Badge>
          </Card.Header>
          <Card.Body>
            <Accordion>
              {rows.map((faq, index) => (
                <Accordion.Item eventKey={String(index)} key={faq._id}>
                  <Accordion.Header>
                    {faq.question}
                    {faq.active === false && <Badge bg="warning" className="ms-2">Inactive</Badge>}
                  </Accordion.Header>
                  <Accordion.Body>
                    <p>{faq.answer}</p>
                    <div className="d-flex gap-2">
                      <Button variant="outline-primary" size="sm" onClick={() => openModal(faq)}>Edit</Button>
                      <Button variant="outline-danger" size="sm" onClick={() => handleDelete(faq._id)}><Trash2 size={14} /></Button>
                    </div>
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          </Card.Body>
        </Card>
      ))}

      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton><Modal.Title>{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</Modal.Title></Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Question</Form.Label>
              <Form.Control value={formData.question} onChange={(e) => setFormData({ ...formData, question: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Answer</Form.Label>
              <Form.Control as="textarea" rows={4} value={formData.answer} onChange={(e) => setFormData({ ...formData, answer: e.target.value })} required />
            </Form.Group>
            <Row>
              <Col md={6}><Form.Group className="mb-3"><Form.Label>Category</Form.Label><Form.Control value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-3"><Form.Label>Order</Form.Label><Form.Control type="number" value={formData.order} onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })} /></Form.Group></Col>
            </Row>
            <Form.Check type="switch" label="Active" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save FAQ'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default FAQs;
