import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Races } from './pages/Races';
import { Drivers } from './pages/Drivers';
import { Telemetry } from './pages/Telemetry';
import { Comparisons } from './pages/Comparisons';
import { Settings } from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/races" element={<Races />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/telemetry" element={<Telemetry />} />
          <Route path="/comparisons" element={<Comparisons />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
