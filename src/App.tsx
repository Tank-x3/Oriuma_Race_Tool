import { Layout } from './components/layout/Layout';
import { SetupScene } from './components/scene/SetupScene';
import { GateScene } from './components/scene/GateScene';
import { RaceScene } from './components/scene/RaceScene';
import { JudgmentScene } from './components/scene/JudgmentScene';
import { ResultScene } from './components/scene/ResultScene';
import { useRaceStore } from './store/useRaceStore';

function App() {
  const { uiState } = useRaceStore();

  return (
    <Layout>
      {uiState.scene === 'setup' && <SetupScene />}
      {uiState.scene === 'gate' && <GateScene />}
      {/* Duplicate removed */}
      {uiState.scene === 'race' && <RaceScene />}
      {uiState.scene === 'judgment' && <JudgmentScene />}
      {uiState.scene === 'result' && <ResultScene />}
    </Layout>
  )
}

export default App
