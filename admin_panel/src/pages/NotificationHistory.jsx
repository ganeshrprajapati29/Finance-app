import { useState, useEffect } from 'react';
import { Table, Card, Badge, Pagination } from 'react-bootstrap';
import api from '../api/axios';

export default function NotificationHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadHistory();
  }, [page]);

  const loadHistory = async () => {
    try {
      const res = await api.get(`/admin/notification-history?page=${page}`);
      setHistory(res.data.data.history);
      setTotalPages(res.data.data.pagination.pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <Card className="p-3 mb-3">
        <h4>Notification History</h4>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Title</th>
              <th>Message</th>
              <th>Sent To</th>
              <th>Recipients</th>
              <th>Sent By</th>
              <th>Sent At</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item._id}>
                <td>{item.title}</td>
                <td>{item.message}</td>
                <td>
                  <Badge bg={item.sentTo === 'all' ? 'primary' : 'secondary'}>
                    {item.sentTo === 'all' ? 'All Users' : item.userId?.name || 'Unknown'}
                  </Badge>
                </td>
                <td>{item.totalRecipients}</td>
                <td>{item.sentBy?.name || 'Unknown'}</td>
                <td>{formatDate(item.sentAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pagination>
          {[...Array(totalPages)].map((_, i) => (
            <Pagination.Item
              key={i + 1}
              active={i + 1 === page}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </Pagination.Item>
          ))}
        </Pagination>
      </Card>
    </div>
  );
}
