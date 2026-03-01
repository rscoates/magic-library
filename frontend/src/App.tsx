import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Layout from './components/Layout';
import AddCard from './pages/AddCard';
import SearchCollection from './pages/SearchCollection';
import DecklistChecker from './pages/DecklistChecker';
import ManageContainers from './pages/ManageContainers';
import BulkImportExport from './pages/BulkImportExport';
import Login from './pages/Login';
import CollectionEntries from './pages/CollectionEntries';
import CollectionValue from './pages/CollectionValue';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/add" replace />} />
        <Route path="/add" element={<AddCard />} />
        <Route path="/search" element={<SearchCollection />} />
        <Route path="/decklist" element={<DecklistChecker />} />
        <Route path="/containers" element={<ManageContainers />} />
        <Route path="/collection-entries" element={<CollectionEntries />} />
        <Route path="/value" element={<CollectionValue />} />
        <Route path="/bulk" element={<BulkImportExport />} />
      </Routes>
    </Layout>
  );
}

export default App;
