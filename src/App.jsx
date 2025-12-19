import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import PersonalDashboard from './pages/PersonalDashboard';
import ManagementDashboard from './pages/ManagementDashboard';
import CreateTask from './pages/CreateTask';
import TaskDetail from './pages/TaskDetail';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<PersonalDashboard />} />
            <Route path="management" element={<ManagementDashboard />} />
            <Route path="create-task" element={<CreateTask />} />
            <Route path="tasks/:taskId" element={<TaskDetail />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="/" element={<Navigate to="/app" />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
