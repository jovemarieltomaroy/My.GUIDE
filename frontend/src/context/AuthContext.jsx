import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

const AuthContext = createContext(null);

const AUTH_USER_KEY = "myguide_authenticated_user";

function getStoredUser() {
  try {
    const storedUser =
      sessionStorage.getItem(AUTH_USER_KEY);

    return storedUser
      ? JSON.parse(storedUser)
      : null;
  } catch (error) {
    console.error(
      "Unable to read stored user:",
      error,
    );

    sessionStorage.removeItem(AUTH_USER_KEY);

    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(
    getStoredUser,
  );

  const setUser = (authenticatedUser) => {
    if (!authenticatedUser) {
      setUserState(null);
      sessionStorage.removeItem(AUTH_USER_KEY);
      return;
    }

    setUserState(authenticatedUser);

    sessionStorage.setItem(
      AUTH_USER_KEY,
      JSON.stringify(authenticatedUser),
    );
  };

  const clearUser = () => {
    setUserState(null);
    sessionStorage.removeItem(AUTH_USER_KEY);
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      setUser,
      clearUser,
    }),
    [user],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}