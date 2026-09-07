import React, { useMemo, useState } from 'react';
import { Badge, Button, Col, Form, InputGroup, ProgressBar, Row, Table } from 'react-bootstrap';
import {
  Banknote,
  Calendar,
  Calculator,
  Clipboard,
  Download,
  Percent,
  PieChart,
  RefreshCw,
  WalletCards
} from 'lucide-react';

const today = new Date().toISOString().slice(0, 10);

const defaults = {
  amount: 25000,
  rate: 18,
  tenure: 12,
  fee: 2,
  date: today,
  mode: 'reducing'
};

const amountPresets = [5000, 10000, 15000, 25000, 50000, 75000, 100000, 200000];
const tenurePresets = [3, 6, 9, 12, 18, 24, 36, 48];
const ratePresets = [0, 10, 12, 15, 18, 24, 30, 36];

const formatCurrency = (amount) => {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const downloadCsv = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const buildSchedule = ({ amount, rate, tenure, date, mode }) => {
  const principal = clampNumber(amount, 0, 0, 100000000);
  const months = clampNumber(tenure, 1, 1, 360);
  const annualRate = clampNumber(rate, 0, 0, 120);
  const monthlyRate = annualRate / 12 / 100;
  const schedule = [];
  let emi = 0;
  let totalInterest = 0;

  if (mode === 'flat') {
    const flatInterest = principal * (annualRate / 100) * (months / 12);
    emi = (principal + flatInterest) / months;
    const monthlyPrincipal = principal / months;
    const monthlyInterest = flatInterest / months;
    let balance = principal;

    for (let i = 1; i <= months; i += 1) {
      const principalPart = i === months ? balance : monthlyPrincipal;
      balance = Math.max(balance - principalPart, 0);
      schedule.push({
        installmentNo: i,
        dueDate: addMonths(date, i).toISOString().slice(0, 10),
        openingBalance: balance + principalPart,
        principal: principalPart,
        interest: monthlyInterest,
        total: principalPart + monthlyInterest,
        closingBalance: balance
      });
    }
    totalInterest = flatInterest;
  } else {
    emi = monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate * ((1 + monthlyRate) ** months)) / (((1 + monthlyRate) ** months) - 1);

    let balance = principal;
    for (let i = 1; i <= months; i += 1) {
      const interestPart = balance * monthlyRate;
      const principalPart = i === months ? balance : Math.min(emi - interestPart, balance);
      const total = principalPart + interestPart;
      balance = Math.max(balance - principalPart, 0);
      totalInterest += interestPart;

      schedule.push({
        installmentNo: i,
        dueDate: addMonths(date, i).toISOString().slice(0, 10),
        openingBalance: balance + principalPart,
        principal: principalPart,
        interest: interestPart,
        total,
        closingBalance: balance
      });
    }
  }

  const totalPayment = schedule.reduce((sum, item) => sum + item.total, 0);
  return { emi, totalInterest, totalPayment, schedule };
};

const StatCard = ({ icon: Icon, label, value, tone, note }) => (
  <div className={`calc-stat calc-stat-${tone}`}>
    <div className="calc-stat-icon"><Icon size={20} /></div>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  </div>
);

const LoanCalculator = () => {
  const [form, setForm] = useState(defaults);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => buildSchedule(form), [form]);
  const processingFee = useMemo(() => (Number(form.amount || 0) * Number(form.fee || 0)) / 100, [form.amount, form.fee]);
  const netDisbursal = Number(form.amount || 0) - processingFee;
  const totalWithFee = result.totalPayment + processingFee;
  const interestShare = totalWithFee > 0 ? Math.round((result.totalInterest / totalWithFee) * 100) : 0;
  const principalShare = totalWithFee > 0 ? Math.round((Number(form.amount || 0) / totalWithFee) * 100) : 0;
  const firstDue = result.schedule[0]?.dueDate;
  const lastDue = result.schedule[result.schedule.length - 1]?.dueDate;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetCalculator = () => {
    setForm({ ...defaults, date: today });
    setCopied(false);
  };

  const exportSchedule = () => {
    downloadCsv(
      result.schedule.map((item) => ({
        installment: item.installmentNo,
        dueDate: formatDate(item.dueDate),
        openingBalance: item.openingBalance.toFixed(2),
        principal: item.principal.toFixed(2),
        interest: item.interest.toFixed(2),
        emi: item.total.toFixed(2),
        closingBalance: item.closingBalance.toFixed(2)
      })),
      `loan-calculator-${form.amount}-${form.tenure}-months.csv`
    );
  };

  const copySummary = async () => {
    const text = [
      `Loan Amount: ${formatCurrency(form.amount)}`,
      `APR: ${form.rate}%`,
      `Tenure: ${form.tenure} months`,
      `EMI: ${formatCurrency(result.emi)}`,
      `Total Interest: ${formatCurrency(result.totalInterest)}`,
      `Total Payable: ${formatCurrency(totalWithFee)}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="loan-calc-page">
      <div className="calc-header">
        <div>
          <div className="calc-eyebrow">Loan Tools</div>
          <h1>Loan Calculator</h1>
          <p>EMI, interest, processing fee, net disbursal aur month-wise amortization schedule live calculate karein.</p>
        </div>
        <div className="calc-header-actions">
          <Button variant="light" onClick={copySummary}>
            <Clipboard size={16} /> {copied ? 'Copied' : 'Copy Summary'}
          </Button>
          <Button variant="outline-light" onClick={resetCalculator}>
            <RefreshCw size={16} /> Reset
          </Button>
        </div>
      </div>

      <Row className="g-3 mt-1">
        <Col xl={4}>
          <div className="calc-panel">
            <div className="calc-panel-head">
              <h2><Calculator size={20} /> Parameters</h2>
              <Badge bg={form.mode === 'reducing' ? 'success' : 'info'}>{form.mode === 'reducing' ? 'Reducing Balance' : 'Flat Rate'}</Badge>
            </div>

            <Form.Group className="calc-control">
              <Form.Label>Loan Amount</Form.Label>
              <InputGroup>
                <InputGroup.Text>Rs.</InputGroup.Text>
                <Form.Control
                  type="number"
                  value={form.amount}
                  min={1000}
                  max={2000000}
                  step={500}
                  onChange={(event) => updateField('amount', clampNumber(event.target.value, defaults.amount, 0, 2000000))}
                />
              </InputGroup>
              <Form.Range min={1000} max={200000} step={1000} value={Math.min(form.amount, 200000)} onChange={(event) => updateField('amount', Number(event.target.value))} />
              <div className="calc-preset-row">
                {amountPresets.map((amount) => (
                  <Button key={amount} size="sm" variant={Number(form.amount) === amount ? 'primary' : 'outline-primary'} onClick={() => updateField('amount', amount)}>
                    {amount >= 100000 ? `${amount / 100000}L` : `${amount / 1000}K`}
                  </Button>
                ))}
              </div>
            </Form.Group>

            <Form.Group className="calc-control">
              <Form.Label>Annual Interest Rate</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  value={form.rate}
                  min={0}
                  max={120}
                  step={0.1}
                  onChange={(event) => updateField('rate', clampNumber(event.target.value, defaults.rate, 0, 120))}
                />
                <InputGroup.Text>% APR</InputGroup.Text>
              </InputGroup>
              <Form.Range min={0} max={60} step={0.5} value={Math.min(form.rate, 60)} onChange={(event) => updateField('rate', Number(event.target.value))} />
              <div className="calc-preset-row">
                {ratePresets.map((rate) => (
                  <Button key={rate} size="sm" variant={Number(form.rate) === rate ? 'primary' : 'outline-primary'} onClick={() => updateField('rate', rate)}>
                    {rate}%
                  </Button>
                ))}
              </div>
            </Form.Group>

            <Form.Group className="calc-control">
              <Form.Label>Tenure</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  value={form.tenure}
                  min={1}
                  max={360}
                  onChange={(event) => updateField('tenure', clampNumber(event.target.value, defaults.tenure, 1, 360))}
                />
                <InputGroup.Text>months</InputGroup.Text>
              </InputGroup>
              <Form.Range min={1} max={60} step={1} value={Math.min(form.tenure, 60)} onChange={(event) => updateField('tenure', Number(event.target.value))} />
              <div className="calc-preset-row">
                {tenurePresets.map((months) => (
                  <Button key={months} size="sm" variant={Number(form.tenure) === months ? 'primary' : 'outline-primary'} onClick={() => updateField('tenure', months)}>
                    {months}m
                  </Button>
                ))}
              </div>
            </Form.Group>

            <Row className="g-3">
              <Col md={6}>
                <Form.Group className="calc-control">
                  <Form.Label>Processing Fee</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="number"
                      value={form.fee}
                      min={0}
                      max={25}
                      step={0.1}
                      onChange={(event) => updateField('fee', clampNumber(event.target.value, defaults.fee, 0, 25))}
                    />
                    <InputGroup.Text>%</InputGroup.Text>
                  </InputGroup>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="calc-control">
                  <Form.Label>Disbursement Date</Form.Label>
                  <Form.Control type="date" value={form.date} onChange={(event) => updateField('date', event.target.value || today)} />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="calc-control mb-0">
              <Form.Label>Interest Method</Form.Label>
              <div className="calc-segment">
                <button type="button" className={form.mode === 'reducing' ? 'active' : ''} onClick={() => updateField('mode', 'reducing')}>Reducing</button>
                <button type="button" className={form.mode === 'flat' ? 'active' : ''} onClick={() => updateField('mode', 'flat')}>Flat</button>
              </div>
            </Form.Group>
          </div>
        </Col>

        <Col xl={8}>
          <Row className="g-3">
            <Col md={6} xxl={3}>
              <StatCard icon={WalletCards} label="Monthly EMI" value={formatCurrency(result.emi)} tone="green" note={`${form.tenure} installments`} />
            </Col>
            <Col md={6} xxl={3}>
              <StatCard icon={Percent} label="Total Interest" value={formatCurrency(result.totalInterest)} tone="amber" note={`${interestShare}% of payable`} />
            </Col>
            <Col md={6} xxl={3}>
              <StatCard icon={Banknote} label="Net Disbursal" value={formatCurrency(netDisbursal)} tone="blue" note={`Fee ${formatCurrency(processingFee)}`} />
            </Col>
            <Col md={6} xxl={3}>
              <StatCard icon={PieChart} label="Total Payable" value={formatCurrency(totalWithFee)} tone="purple" note="EMI + fee" />
            </Col>
          </Row>

          <Row className="g-3 mt-1">
            <Col lg={7}>
              <div className="calc-panel h-100">
                <div className="calc-panel-head">
                  <h2><PieChart size={20} /> Payment Breakdown</h2>
                  <Badge bg="secondary">{formatDate(firstDue)} to {formatDate(lastDue)}</Badge>
                </div>

                <div className="calc-breakdown">
                  <div>
                    <div className="d-flex justify-content-between">
                      <span>Principal</span>
                      <strong>{formatCurrency(form.amount)}</strong>
                    </div>
                    <ProgressBar now={principalShare} variant="primary" />
                  </div>
                  <div>
                    <div className="d-flex justify-content-between">
                      <span>Interest</span>
                      <strong>{formatCurrency(result.totalInterest)}</strong>
                    </div>
                    <ProgressBar now={interestShare} variant="warning" />
                  </div>
                  <div>
                    <div className="d-flex justify-content-between">
                      <span>Processing Fee</span>
                      <strong>{formatCurrency(processingFee)}</strong>
                    </div>
                    <ProgressBar now={totalWithFee ? (processingFee / totalWithFee) * 100 : 0} variant="info" />
                  </div>
                </div>

                <div className="calc-disbursal">
                  <div>
                    <span>Customer receives</span>
                    <strong>{formatCurrency(netDisbursal)}</strong>
                  </div>
                  <div>
                    <span>Average monthly principal</span>
                    <strong>{formatCurrency(Number(form.amount || 0) / Number(form.tenure || 1))}</strong>
                  </div>
                </div>
              </div>
            </Col>
            <Col lg={5}>
              <div className="calc-panel h-100">
                <div className="calc-panel-head">
                  <h2><Calendar size={20} /> Loan Timeline</h2>
                </div>
                <div className="calc-timeline">
                  <div><span>Disbursement</span><strong>{formatDate(form.date)}</strong></div>
                  <div><span>First EMI</span><strong>{formatDate(firstDue)}</strong></div>
                  <div><span>Final EMI</span><strong>{formatDate(lastDue)}</strong></div>
                  <div><span>Interest Method</span><strong>{form.mode === 'reducing' ? 'Reducing balance' : 'Flat interest'}</strong></div>
                </div>
              </div>
            </Col>
          </Row>

          <div className="calc-panel mt-3">
            <div className="calc-panel-head">
              <div>
                <h2>Amortization Schedule</h2>
                <p>Principal, interest aur closing balance month-wise.</p>
              </div>
              <Button variant="outline-success" onClick={exportSchedule}>
                <Download size={16} /> Export CSV
              </Button>
            </div>

            <div className="table-responsive calc-table-wrap">
              <Table hover className="calc-table mb-0">
                <thead>
                  <tr>
                    <th>EMI</th>
                    <th>Due Date</th>
                    <th>Opening</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Total EMI</th>
                    <th>Closing</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {result.schedule.map((row) => {
                    const progress = Math.round((row.installmentNo / form.tenure) * 100);
                    return (
                      <tr key={row.installmentNo}>
                        <td><Badge bg="primary">#{row.installmentNo}</Badge></td>
                        <td>{formatDate(row.dueDate)}</td>
                        <td>{formatCurrency(row.openingBalance)}</td>
                        <td>{formatCurrency(row.principal)}</td>
                        <td>{formatCurrency(row.interest)}</td>
                        <td><strong>{formatCurrency(row.total)}</strong></td>
                        <td>{formatCurrency(row.closingBalance)}</td>
                        <td className="calc-progress-cell">
                          <ProgressBar now={progress} variant="success" />
                          <small>{progress}%</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </div>
        </Col>
      </Row>

      <style>{`
        .loan-calc-page { color: #0f172a; }
        .calc-header { background: linear-gradient(135deg, #0f172a 0%, #0f766e 55%, #1d4ed8 100%); border-radius: 18px; padding: 28px; color: #fff; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18); }
        .calc-header h1 { margin: 2px 0 8px; font-size: 30px; font-weight: 850; letter-spacing: 0; }
        .calc-header p { margin: 0; max-width: 760px; color: rgba(255, 255, 255, 0.78); font-weight: 500; }
        .calc-eyebrow { font-size: 12px; text-transform: uppercase; font-weight: 800; color: #bfdbfe; }
        .calc-header-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
        .calc-header-actions .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; white-space: nowrap; }
        .calc-panel, .calc-stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06); }
        .calc-panel { padding: 20px; }
        .calc-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
        .calc-panel-head h2 { margin: 0; font-size: 19px; font-weight: 850; display: flex; align-items: center; gap: 8px; }
        .calc-panel-head p { margin: 4px 0 0; color: #64748b; font-weight: 600; }
        .calc-control { margin-bottom: 20px; }
        .calc-control label { color: #334155; font-size: 13px; font-weight: 850; }
        .calc-control .form-range { margin: 12px 0 4px; }
        .calc-preset-row { display: flex; flex-wrap: wrap; gap: 7px; }
        .calc-preset-row .btn { min-width: 48px; font-weight: 800; }
        .calc-segment { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 5px; background: #f1f5f9; border-radius: 12px; border: 1px solid #e2e8f0; }
        .calc-segment button { border: 0; border-radius: 9px; padding: 10px 12px; background: transparent; color: #475569; font-weight: 850; }
        .calc-segment button.active { background: #0f766e; color: #fff; box-shadow: 0 8px 18px rgba(15, 118, 110, 0.22); }
        .calc-stat { min-height: 116px; padding: 17px; display: flex; gap: 13px; align-items: flex-start; }
        .calc-stat-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: #fff; flex-shrink: 0; }
        .calc-stat-green .calc-stat-icon { background: #059669; }
        .calc-stat-amber .calc-stat-icon { background: #d97706; }
        .calc-stat-blue .calc-stat-icon { background: #2563eb; }
        .calc-stat-purple .calc-stat-icon { background: #7c3aed; }
        .calc-stat span { display: block; font-size: 12px; color: #64748b; font-weight: 850; text-transform: uppercase; }
        .calc-stat strong { display: block; margin-top: 3px; font-size: 19px; color: #0f172a; font-weight: 850; }
        .calc-stat small { display: block; margin-top: 3px; color: #64748b; font-weight: 700; }
        .calc-breakdown { display: grid; gap: 16px; }
        .calc-breakdown span { color: #475569; font-weight: 800; }
        .calc-breakdown strong { color: #0f172a; }
        .calc-breakdown .progress { height: 10px; margin-top: 9px; }
        .calc-disbursal { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
        .calc-disbursal div, .calc-timeline div { padding: 13px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 11px; }
        .calc-disbursal span, .calc-timeline span { display: block; font-size: 12px; color: #64748b; font-weight: 850; text-transform: uppercase; }
        .calc-disbursal strong, .calc-timeline strong { display: block; margin-top: 4px; color: #0f172a; overflow-wrap: anywhere; }
        .calc-timeline { display: grid; gap: 11px; }
        .calc-table-wrap { max-height: 520px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 12px; }
        .calc-table thead th { position: sticky; top: 0; z-index: 1; background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
        .calc-table td { vertical-align: middle; color: #334155; font-weight: 600; white-space: nowrap; }
        .calc-progress-cell { min-width: 110px; }
        .calc-progress-cell .progress { height: 7px; }
        .calc-progress-cell small { color: #64748b; font-weight: 800; }
        @media (max-width: 768px) {
          .calc-header { flex-direction: column; padding: 22px; }
          .calc-header h1 { font-size: 25px; }
          .calc-header-actions { width: 100%; justify-content: stretch; }
          .calc-header-actions .btn { flex: 1; justify-content: center; }
          .calc-disbursal { grid-template-columns: 1fr; }
          .calc-panel { padding: 16px; }
        }
      `}</style>
    </div>
  );
};

export default LoanCalculator;
