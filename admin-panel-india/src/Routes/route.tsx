import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../Helper/AuthContext";
import DashboardLayout from "../Component/Layouts/DashboardLayout";
import Login from "../pages/Login";
import Overview from "../pages/Overview";
import Companies from "../pages/Companies";
import Users from "../pages/Users";
import Agents from "../pages/Agents";
import PhoneNumbers from "../pages/PhoneNumbers";
import Blacklist from "../pages/Blacklist";
import BatchCalls from "../pages/BatchCalls";


const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();

    if (loading)
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-main">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );

    if (!user) return <Navigate to="/login" replace />;

    return <>{children}</>;
};

function AppRoutes() {
    const { user } = useAuth();

    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <DashboardLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to="/dashboard" replace />} />

                {/* Dashboard */}
                <Route path="dashboard" element={<Overview />} />

                {/* Admin Required Management Routes */}
                <Route
                    path="companies"
                    element={
                        user?.isAdmin && user?.isSuperAdmin ? (
                            <Companies />
                        ) : (
                            <Navigate to="/dashboard" replace />
                        )
                    }
                />

                <Route
                    path="users"
                    element={
                        user?.isAdmin ? (
                            <Users />
                        ) : (
                            <Navigate to="/dashboard" replace />
                        )
                    }
                />

                <Route
                    path="agents"
                    element={
                        user?.isAdmin ? (
                            <Agents />
                        ) : (
                            <Navigate to="/dashboard" replace />
                        )
                    }
                />

                {/* Core Modules - Accessible to All Authenticated Users */}
                <Route
                    path="phone-numbers"
                    element={user?.isAdmin ? <PhoneNumbers /> : <Navigate to="/dashboard" replace />}
                />
                <Route
                    path="blacklist"
                    element={user?.isAdmin ? <Blacklist /> : <Navigate to="/dashboard" replace />}
                />
                <Route
                    path="batch-calls"
                    element={user?.isAdmin ? <BatchCalls /> : <Navigate to="/dashboard" replace />}
                />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default AppRoutes;
