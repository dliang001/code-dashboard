import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Topbar } from "./components/Topbar";
import Grid from "./pages/Grid";
import Detail from "./pages/Detail";

export default function App() {
  return (
    <BrowserRouter>
      <Topbar />
      <Routes>
        <Route path="/" element={<Grid />} />
        <Route path="/project/:id/*" element={<Detail />} />
      </Routes>
    </BrowserRouter>
  );
}
