import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { Topbar } from "./components/Topbar";
import { LogsConsole } from "./components/LogsConsole";
import Grid from "./pages/Grid";
import Detail from "./pages/Detail";
import { useAppSettings } from "./hooks/useAppSettings";

export default function App() {
  const { settings, set } = useAppSettings();
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsProjectId, setLogsProjectId] = useState<string | null>(null);

  return (
    <BrowserRouter>
      <div className="app">
        <Topbar
          settings={settings}
          setSetting={set}
          onOpenLogs={(id?: string) => {
            if (id) setLogsProjectId(id);
            setLogsOpen(true);
          }}
        />
        <main className="main">
          <Routes>
            <Route
              path="/"
              element={
                <Grid
                  onOpenLogs={(id) => {
                    setLogsProjectId(id);
                    setLogsOpen(true);
                  }}
                />
              }
            />
            <Route
              path="/project/:id/*"
              element={
                <Detail
                  onOpenLogs={(id) => {
                    setLogsProjectId(id);
                    setLogsOpen(true);
                  }}
                />
              }
            />
          </Routes>
        </main>
        {logsOpen && logsProjectId && (
          <LogsConsole
            projectId={logsProjectId}
            floating
            onClose={() => setLogsOpen(false)}
          />
        )}
      </div>
    </BrowserRouter>
  );
}
