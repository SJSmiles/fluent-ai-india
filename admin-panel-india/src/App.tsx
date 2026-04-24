import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./Helper/AuthContext";
import AppRoutes from "./Routes/route";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
