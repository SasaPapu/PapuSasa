import { Pause, Play } from 'lucide-react';

// Botón de pausa unificado: misma apariencia y comportamiento en todas las
// representaciones (3D y 2D). Muestra icono + texto "Pausar"/"Reanudar".
export default function PauseButton({ paused, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="absolute bottom-2 right-2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-black/65 backdrop-blur-sm border border-white/25 text-white/90 hover:text-white hover:bg-black/85 text-xs font-medium transition-colors select-none cursor-pointer"
      title={paused ? 'Reanudar' : 'Pausar'}
    >
      {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      {paused ? 'Reanudar' : 'Pausar'}
    </button>
  );
}