import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Users,
  LogOut,
  Menu,
  Smartphone,
  FolderTree,
  Layout,
  Contact,
  Send,
  KeyRound,
  X
} from "lucide-react";
import { useAuth } from "../../Helper/AuthContext";
import { authService } from "../../api/authService";
import Toast from "../toaster/Toast";

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setToast({ message: "Passwords do not match", type: 'error' });
      return;
    }
    setPasswordLoading(true);
    try {
      await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setToast({ message: "Password changed successfully", type: 'success' });
      setPasswordModalOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || "Failed to change password", type: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Role-based navigation
  const navItems = [
    { to: "/dashboard", icon: BarChart3, label: "Overview" },
    ...(user?.isAdmin && user?.isSuperAdmin
      ? [{ to: "/companies", icon: Building2, label: "Companies" }]
      : []),
    ...(user?.isAdmin
      ? [
        { to: "/users", icon: Users as any, label: "Users" },
        { to: "/devices", icon: Smartphone, label: "Devices" },
        { to: "/groups", icon: FolderTree, label: "Groups" },
        { to: "/contacts", icon: Contact, label: "Contacts" },
        { divider: true },
        { to: "/campaigns", icon: Send, label: "Campaigns" },
        { to: "/templates", icon: Layout, label: "Templates" },
      ]
      : [
        { to: "/devices", icon: Smartphone, label: "Devices" },
        { to: "/groups", icon: FolderTree, label: "Groups" },
        { to: "/contacts", icon: Contact, label: "Contacts" },
        { divider: true },
        { to: "/campaigns", icon: Send, label: "Campaigns" },
        { to: "/templates", icon: Layout, label: "Templates" },
      ]),
  ];

  return (
    <div className="flex h-screen bg-[#f7f8fa] overflow-hidden w-full">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarOpen ? "260px" : "72px",
          transition: "width 0.3s ease",
          borderRight: "1px solid #eaeaed",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Logo + Toggle */}
        <div
          style={{
            height: "64px",
            display: "flex",
            alignItems: "center",
            padding: sidebarOpen ? "0 12px 0 20px" : "0",
            justifyContent: sidebarOpen ? "space-between" : "center",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                background: "#0a485e",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Building2 size={18} color="#fff" />
            </div>
            {sidebarOpen && (
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "16px",
                  color: "#0a485e",
                }}
              >
                WA Manager
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#999",
              display: "flex",
              alignItems: "center",
              padding: "6px",
              borderRadius: "8px",
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f4f7f8")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {navItems.map((item, idx) => {
            if ((item as any).divider) {
              return <div key={`div-${idx}`} style={{ height: '1px', background: '#f0f0f0', margin: '12px 14px' }} />;
            }
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                style={{ textDecoration: "none" }}
              >
                {({ isActive }) => (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: sidebarOpen ? "10px 14px" : "10px",
                      justifyContent: sidebarOpen ? "flex-start" : "center",
                      borderRadius: "10px",
                      marginBottom: "2px",
                      background: isActive ? "#0a485e" : "transparent",
                      color: isActive ? "#fff" : "#666",
                      fontWeight: 600,
                      fontSize: "14px",
                      transition: "all 0.15s ease",
                      cursor: "pointer",
                    }}
                  >
                    {item.icon && <item.icon size={19} />}
                    {sidebarOpen && <span>{item.label}</span>}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "16px 12px", borderTop: "1px solid #f0f0f0" }}>
          {sidebarOpen && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "0 6px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  background: "#f4f7f8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#0a485e",
                }}
              >
                {user?.userName?.charAt(0).toUpperCase() || "A"}
              </div>

              <div>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0a0a0a",
                    lineHeight: 1.2,
                  }}
                >
                  {user?.userName || "Admin"}
                </p>

                <p style={{ fontSize: "11px", color: "#999" }}>
                  {user?.isSuperAdmin
                    ? "Super Admin"
                    : user?.isAdmin
                      ? "Company Admin"
                      : "User"}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => setPasswordModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "10px 14px",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              borderRadius: "10px",
              border: "none",
              background: "transparent",
              color: "#888",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: "4px"
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#0a485e")}
            onMouseLeave={e => (e.currentTarget.style.color = "#888")}
          >
            <KeyRound size={18} />
            {sidebarOpen && <span>Change Password</span>}
          </button>

          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "10px 14px",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              borderRadius: "10px",
              border: "none",
              background: "transparent",
              color: "#888",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#dc2626")}
            onMouseLeave={e => (e.currentTarget.style.color = "#888")}
          >
            <LogOut size={18} />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Section */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100vh",
          overflow: "hidden"
        }}
      >
        {/* Page Content */}
        <main
          style={{
            flex: 1,
            padding: "24px 32px",
            width: "100%",
            minWidth: 0,
            overflowY: "auto",
            height: "100%"
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>Change Password</h2>
              <button onClick={() => setPasswordModalOpen(false)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>Current Password</label>
                <input 
                  type="password" 
                  required 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb' }}
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>New Password</label>
                <input 
                  type="password" 
                  required 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb' }}
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>Confirm New Password</label>
                <input 
                  type="password" 
                  required 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb' }}
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
              </div>
              <button 
                type="submit" 
                disabled={passwordLoading}
                style={{ 
                  width: '100%', 
                  background: '#0a485e', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '12px', 
                  borderRadius: '10px', 
                  fontWeight: 700, 
                  fontSize: '14px', 
                  cursor: passwordLoading ? 'not-allowed' : 'pointer',
                  opacity: passwordLoading ? 0.7 : 1
                }}
              >
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
