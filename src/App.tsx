import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewBooking } from './pages/NewBooking';
import { Orders } from './pages/Orders';
import { DeliveryScanner } from './pages/DeliveryScanner';
import { Payments } from './pages/Payments';
import { Inventory } from './pages/Inventory';
import { Customers } from './pages/Customers';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Toaster } from 'sonner';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Main SaaS Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/booking" element={
            <ProtectedRoute>
              <Layout>
                <NewBooking />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/orders" element={
            <ProtectedRoute>
              <Layout>
                <Orders />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/delivery" element={
            <ProtectedRoute>
              <Layout>
                <DeliveryScanner />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/payments" element={
            <ProtectedRoute>
              <Layout>
                <Payments />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/inventory" element={
            <ProtectedRoute>
              <Layout>
                <Inventory />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/customers" element={
            <ProtectedRoute>
              <Layout>
                <Customers />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/reports" element={
            <ProtectedRoute>
              <Layout>
                <Reports />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          } />

          {/* Fallback Wildcard Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global Toast Alerts */}
        <Toaster 
          position="top-right" 
          toastOptions={{
            style: {
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '16px',
              fontSize: '12px'
            }
          }}
        />
      </AuthProvider>
    </Router>
  );
}

export default App;
