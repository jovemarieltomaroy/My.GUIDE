import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AccountSetupRoute({ children }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword === true) {
    return <Navigate to="/change-password" replace />;
  }

  if (user.profileCompleted === false) {
    return <Navigate to="/complete-profile" replace />;
  }

  return children;
}
