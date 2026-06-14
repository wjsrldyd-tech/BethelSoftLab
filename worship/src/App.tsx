import Layout from './components/Layout';
import InputPanel from './components/InputPanel';
import PreviewPanel from './components/PreviewPanel';

function App() {
  return (
    <Layout
      leftPanel={<InputPanel />}
      rightPanel={<PreviewPanel />}
    />
  );
}

export default App;
