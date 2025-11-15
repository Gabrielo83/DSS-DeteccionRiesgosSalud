import { createContext } from "react";

const AuthContext = createContext({
  role: null,
  isAuthenticated: false,
  allowedRoutes: [],
  logout: () => {},
});

export default AuthContext;
