import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Chat from "./pages/Chat";

const App = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/chat" element={<Chat />} />
  </Routes>
);

export default App;
