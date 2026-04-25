import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import logoIcon from "../../assets/logo-icon.svg";
import {
  BarChart3,
  Building2,
  Users,
  LogOut,
  Menu,
  Cpu,
  KeyRound,
  Phone,
  Ban,
  PhoneCall,
  X
} from "lucide-react";
import { useAuth } from "../../Helper/AuthContext";
import { authService } from "../../api/authService";
import Toast from "../toaster/Toast";

// Color tokens matching the Fluent dashboard purple theme
const COLORS = {
  brand: "#6366f1",         // Primary purple (sidebar active bg, logo bg)
  brandDark: "#4f46e5",     // Darker purple for hover states
  brandLight: "#eef2ff",    // Light purple tint for subtle backgrounds
  brandText: "#6366f1",     // Purple text
  sidebar: "#ffffff",       // Sidebar background
  sidebarBorder: "#f3f4f6",
  navActive: "#eef2ff",     // Light purple for active item bg
  navActiveText: "#6366f1", // Purple for active item text
  navInactiveText: "#6b7280",
  navHoverBg: "#f9fafb",
  navHoverText: "#6366f1",
  pageBackground: "#f8fafc",
  text: "#1e293b",
  textMuted: "#94a3b8",
  textSecondary: "#64748b",
  danger: "#ef4444",
};

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setToast({ message: "Passwords do not match", type: "error" });
      return;
    }
    setPasswordLoading(true);
    try {
      await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setToast({ message: "Password changed successfully", type: "success" });
      setPasswordModalOpen(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      setToast({
        message:
          err.response?.data?.message || "Failed to change password",
        type: "error",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Role-based navigation
  const navItems = [
    { to: "/dashboard", icon: BarChart3, label: "Dashboard" },
    ...(user?.superAdmin || user?.isSuperAdmin
      ? [{ to: "/companies", icon: Building2, label: "Companies" }]
      : []),
    ...(user?.isAdmin
      ? [
          { to: "/users", icon: Users as any, label: "Users" },
          { to: "/agents", icon: Cpu as any, label: "Agents" },
          { to: "/phone-numbers", icon: Phone as any, label: "Phone Numbers" },
          { to: "/blacklist", icon: Ban as any, label: "Blacklist Number" },
          {
            to: "/batch-calls",
            icon: PhoneCall as any,
            label: "Batch Call",
          },
        ]
      : []),
  ];

  const roleLabel = user?.isSuperAdmin
    ? "Super Admin"
    : user?.isAdmin
    ? "Company Admin"
    : "User";

  const userInitial = user?.userName?.charAt(0).toUpperCase() || "A";

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: COLORS.pageBackground,
        overflow: "hidden",
        width: "100%",
      }}
    >
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        style={{
          width: sidebarOpen ? "220px" : "68px",
          transition: "width 0.25s ease",
          borderRight: `1px solid ${COLORS.sidebarBorder}`,
          background: COLORS.sidebar,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {/* Logo + Toggle */}
        <div
          style={{
            height: "60px",
            display: "flex",
            alignItems: "center",
            padding: sidebarOpen ? "0 12px 0 16px" : "0",
            justifyContent: sidebarOpen ? "space-between" : "center",
            borderBottom: `1px solid ${COLORS.sidebarBorder}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              overflow: "hidden",
            }}
          >
            {/* Logo mark — purple rounded square */}
            <div
              style={{
                width: "32px",
                height: "32px",
                
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {/* Use <img> instead of Next.js <Image> for plain React */}
              <img
                src={logoIcon}
                alt="Fluent logo"
                width={18}
                height={18}
                style={{ display: "block" }}
              />
            </div>

            {sidebarOpen && (
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "17px",
                  color: COLORS.brand,
                  letterSpacing: "-0.3px",
                  whiteSpace: "nowrap",
                }}
              >
                fluent
              </span>
            )}
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: COLORS.textMuted,
              display: "flex",
              alignItems: "center",
              padding: "6px",
              borderRadius: "7px",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = COLORS.navHoverBg)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <Menu size={17} />
          </button>
        </div>

        {/* Navigation */}
        <nav
          style={{
            flex: 1,
            padding: "16px 0",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {sidebarOpen && (
            <div style={{ padding: "0 24px 8px", fontSize: "11px", fontWeight: 700, color: COLORS.textMuted, letterSpacing: "0.05em" }}>
              MAIN
            </div>
          )}
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.to === "/dashboard"}
              style={{ textDecoration: "none", display: "block", position: "relative" }}
            >
              {({ isActive }) => (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: sidebarOpen ? "10px 24px" : "10px",
                    justifyContent: sidebarOpen ? "flex-start" : "center",
                    background: isActive ? COLORS.navActive : "transparent",
                    color: isActive ? COLORS.navActiveText : COLORS.navInactiveText,
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "14px",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = COLORS.navHoverBg;
                      e.currentTarget.style.color = COLORS.navHoverText;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = COLORS.navInactiveText;
                    }
                  }}
                >
                  {/* Vertical Active Indicator */}
                  {isActive && (
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: COLORS.brand }} />
                  )}
                  
                  <item.icon
                    size={20}
                    style={{ flexShrink: 0 }}
                  />
                  {sidebarOpen && <span>{item.label}</span>}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: "16px",
            borderTop: `1px solid ${COLORS.sidebarBorder}`,
            flexShrink: 0,
          }}
        >
          {/* User info card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: sidebarOpen ? "12px" : "8px",
              marginBottom: "12px",
              borderRadius: "12px",
              background: COLORS.brandLight,
              justifyContent: sidebarOpen ? "flex-start" : "center",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: COLORS.brand,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {userInitial}
            </div>
            {sidebarOpen && (
              <div style={{ overflow: "hidden" }}>
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: COLORS.text,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user?.userName || "Admin"}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: COLORS.brandText,
                    fontWeight: 500,
                    marginTop: "2px",
                  }}
                >
                  {roleLabel}
                </p>
              </div>
            )}
          </div>

          {/* Change Password */}
          <FooterBtn
            icon={<KeyRound size={17} />}
            label="Change Password"
            sidebarOpen={sidebarOpen}
            hoverColor={COLORS.brand}
            onClick={() => setPasswordModalOpen(true)}
          />

          {/* Sign Out */}
          <FooterBtn
            icon={<LogOut size={17} />}
            label="Sign Out"
            sidebarOpen={sidebarOpen}
            hoverColor={COLORS.danger}
            onClick={handleLogout}
          />
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <main
          style={{
            flex: 1,
            padding: "24px 32px",
            width: "100%",
            minWidth: 0,
            overflowY: "auto",
            height: "100%",
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* ── Change Password Modal ── */}
      {passwordModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: "400px",
              borderRadius: "16px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              padding: "32px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: COLORS.text,
                }}
              >
                Change Password
              </h2>
              <button
                onClick={() => setPasswordModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: COLORS.textMuted,
                  cursor: "pointer",
                  borderRadius: "6px",
                  padding: "4px",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f3f4f6")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "none")
                }
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleChangePassword}>
              {(
                [
                  { key: "currentPassword", label: "Current Password" },
                  { key: "newPassword", label: "New Password" },
                  { key: "confirmPassword", label: "Confirm New Password" },
                ] as const
              ).map(({ key, label }, i) => (
                <div
                  key={key}
                  style={{ marginBottom: i === 2 ? "24px" : "16px" }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: COLORS.textSecondary,
                      marginBottom: "6px",
                    }}
                  >
                    {label}
                  </label>
                  <input
                    type="password"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: `1.5px solid #e5e7eb`,
                      borderRadius: "8px",
                      fontSize: "13px",
                      background: "#f9fafb",
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 0.15s",
                    }}
                    value={passwordForm[key]}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, [key]: e.target.value })
                    }
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = COLORS.brand)
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#e5e7eb")
                    }
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={passwordLoading}
                style={{
                  width: "100%",
                  background: COLORS.brand,
                  color: "#fff",
                  border: "none",
                  padding: "12px",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: passwordLoading ? "not-allowed" : "pointer",
                  opacity: passwordLoading ? 0.7 : 1,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!passwordLoading)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      COLORS.brandDark;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    COLORS.brand;
                }}
              >
                {passwordLoading ? "Updating…" : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Small helper so footer buttons stay DRY ── */
interface FooterBtnProps {
  icon: React.ReactNode;
  label: string;
  sidebarOpen: boolean;
  hoverColor: string;
  onClick: () => void;
}
const FooterBtn: React.FC<FooterBtnProps> = ({
  icon,
  label,
  sidebarOpen,
  hoverColor,
  onClick,
}) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      width: "100%",
      padding: "9px 12px",
      justifyContent: sidebarOpen ? "flex-start" : "center",
      borderRadius: "8px",
      border: "none",
      background: "transparent",
      color: "#9ca3af",
      fontSize: "13px",
      fontWeight: 600,
      cursor: "pointer",
      marginBottom: "2px",
      transition: "color 0.15s, background 0.15s",
      whiteSpace: "nowrap",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = hoverColor;
      e.currentTarget.style.background =
        hoverColor === "#dc2626" ? "#fef2f2" : "#f5f3ff";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = "#9ca3af";
      e.currentTarget.style.background = "transparent";
    }}
  >
    {icon}
    {sidebarOpen && <span>{label}</span>}
  </button>
);

export default DashboardLayout;