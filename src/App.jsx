import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import PersonalDashboard from './pages/PersonalDashboard';
import ManagementDashboard from './pages/ManagementDashboard';
import PersonnelManagement from './pages/PersonnelManagement';
import CreateTask from './pages/CreateTask';
import EditTask from './pages/EditTask';
import TaskDetail from './pages/TaskDetail';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import AdminRoute from './components/AdminRoute';
import AdminUserList from './pages/admin/AdminUserList';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminDepartmentList from './pages/admin/AdminDepartmentList';
import AdminDepartmentDetail from './pages/admin/AdminDepartmentDetail';
import AdminManagement from './pages/admin/AdminManagement';
import DataNormalization from './pages/admin/DataNormalization';
import ManagerRoute from './components/ManagerRoute';
import Register from './pages/Register';
import WaitingApproval from './pages/WaitingApproval';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/waiting-approval" element={<WaitingApproval />} />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<PersonalDashboard />} />
            <Route path="create-task" element={<CreateTask />} />
            <Route path="tasks/:taskId" element={<TaskDetail />} />
            <Route path="tasks/:taskId/edit" element={<EditTask />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
          </Route>


          <Route path="/manager" element={<ProtectedRoute><ManagerRoute><AppLayout /></ManagerRoute></ProtectedRoute>}>
            <Route path="dashboard" element={<ManagementDashboard />} />
            <Route path="personnel" element={<PersonnelManagement />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute><AdminRoute><AppLayout /></AdminRoute></ProtectedRoute>}>
            <Route path="management" element={<AdminManagement />} />
            <Route path="users" element={<AdminUserList />} />
            <Route path="users/:uid" element={<AdminUserDetail />} />
            <Route path="departments" element={<AdminDepartmentList />} />
            <Route path="departments/:deptId" element={<AdminDepartmentDetail />} />
            <Route path="normalize-data" element={<DataNormalization />} />
          </Route>

          <Route path="/" element={<Navigate to="/app" />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
