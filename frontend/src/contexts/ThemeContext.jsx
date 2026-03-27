import { createContext, useContext } from "react";
// Theme toggle removed - always dark mode
export const ThemeContext = createContext({});
export const ThemeProvider = ({ children }) => <>{children}</>;
export const useTheme = () => ({ theme: "dark", toggleTheme: () => {} });