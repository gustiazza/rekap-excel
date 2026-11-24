import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import PaguTarget from './pages/PaguTarget';
import Pelaporan from './pages/Pelaporan';
import DetailUpload from './pages/DetailUpload';
import Users from './pages/Users';
import Profile from './pages/Profile';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/pagu" element={<PaguTarget />} />
          <Route path="/pelaporan" element={<Pelaporan />} />
          <Route path="/pelaporan/:id" element={<DetailUpload />} />
          <Route path="/profil" element={<Profile />} />
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/users" element={<Users />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
