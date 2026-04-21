import React, { useState } from 'react';

function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showGrid, setShowGrid] = useState(true);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePredict = async () => {
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedImage);

    try {
      const response = await fetch(`http://localhost:8000/predict?show_grid=${showGrid}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Prediction failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError('Error making prediction: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGrid = async () => {
    if (!selectedImage || !result) return;
    
    setLoading(true);
    const newGridState = !showGrid;
    setShowGrid(newGridState);
    
    const formData = new FormData();
    formData.append('file', selectedImage);

    try {
      const response = await fetch(`http://localhost:8000/predict?show_grid=${newGridState}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Prediction failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError('Error toggling grid: ' + err.message);
      setShowGrid(!newGridState);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setShowGrid(true);
  };

  const getInfestationColor = (level) => {
    if (level === 'Low') return 'bg-green-100 text-green-700 border-green-200';
    if (level === 'Moderate') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <div className="min-h-screen bg-[oklch(30.2%_0.056_229.695)] p-4 sm:p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
             Weed Detection
          </h1>
          <p className="text-lg text-white/90">
            Precision Agriculture Intelligence System
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 backdrop-blur-sm bg-white/95">
          <label className="block mb-8">
            <div className="border-2 border-[oklch(30.2%_0.056_229.695)] border-dashed rounded-2xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 group">
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">
                📸
              </div>
              <p className="text-lg font-semibold text-gray-800 mb-1">
                Click to upload field image
              </p>
              <p className="text-sm text-gray-500">
                PNG, JPG up to 10MB
              </p>
            </div>
            <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          </label>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 rounded-lg animate-pulse">
              <p className="text-red-700 font-semibold">⚠️ {error}</p>
            </div>
          )}

          {preview && !result && (
            <div className="mb-8 animate-in fade-in">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Selected Image</h3>
              <img src={preview} alt="preview" className="w-full h-auto rounded-xl shadow-lg border-2 border-gray-200 max-h-96 object-cover" />
            </div>
          )}

          <div className="flex gap-4 mb-8">
            <button
              onClick={handlePredict}
              disabled={!selectedImage || loading}
              className="flex-1 bg-gradient-to-r from-[oklch(45%_0.085_224.283)] to-[oklch(30.2%_0.056_229.695)] hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg transform hover:-translate-y-1"
            >
              {loading ? 'Processing...' : '🔍 Analyze Field'}
            </button>
            {(selectedImage || result) && (
              <button onClick={handleReset} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-xl transition-all">
                ↺ Reset
              </button>
            )}
          </div>

          {result && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-t-2 border-gray-100 pt-8">
                
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800">Field Insights</h3>
                  <span className={`px-4 py-1 rounded-full border-2 font-bold text-sm ${getInfestationColor(result.infestation_level)}`}>
                    {result.infestation_level} Infestation
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl p-6 text-white shadow-lg">
                    <p className="text-4xl font-bold">{result.crop_count}</p>
                    <p className="text-xs font-bold uppercase tracking-wider mt-1 opacity-80">Healthy Crops</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl p-6 text-white shadow-lg">
                    <p className="text-4xl font-bold">{result.weed_count}</p>
                    <p className="text-xs font-bold uppercase tracking-wider mt-1 opacity-80">Weeds Found</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-8">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                    <p className="text-blue-800 font-bold text-xl leading-tight">{result.growth_stage}</p>
                    <p className="text-blue-600 text-[10px] font-bold uppercase tracking-tight mt-1">Growth Stage</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                    <p className="text-amber-800 font-bold text-xl leading-tight">{result.herbicide_savings}</p>
                    <p className="text-amber-600 text-[10px] font-bold uppercase tracking-tight mt-1">Chem Savings</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
                    <p className="text-purple-800 font-bold text-xl leading-tight">{result.hotspot_zones}</p>
                    <p className="text-purple-600 text-[10px] font-bold uppercase tracking-tight mt-1">Infest Zones</p>
                  </div>
                </div>

                <div className="mb-6 relative">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-gray-700 flex items-center justify-between flex-1">
                      <span>Visual Detection Analysis</span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">93.5% mAP</span>
                    </h4>
                    <button
                      onClick={handleToggleGrid}
                      disabled={loading}
                      className="ml-4 px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded transition-colors"
                    >
                      {showGrid ? '🔳 Hide Grid' : '🔲 Show Grid'}
                    </button>
                  </div>
                  <img src={result.result_image} alt="detection result" className="w-full rounded-xl shadow-2xl border-2 border-gray-100 object-contain" />
                  
                  {/* --- ROBOTIC SPRAYER BOOM INTERFACE --- */}
                  <div className="mt-4 bg-gray-900 p-5 rounded-xl border-t-4 border-blue-500 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-blue-400 text-[10px] font-bold uppercase tracking-[0.2em]">Sprayer Boom Commands (VRA)</h4>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse delay-75"></div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      {result.nozzle_logic && result.nozzle_logic.length > 0 ? (
                        result.nozzle_logic.map((cmd, idx) => (
                          <div key={idx} className="flex-1 text-center group">
                            <div className={`h-4 rounded-md mb-2 transition-all duration-700 border ${
                              cmd === 'HIGH' ? 'bg-red-500 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 
                              cmd === 'LOW' ? 'bg-yellow-500 border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 
                              'bg-gray-800 border-gray-700'
                            }`}></div>
                            <span className={`text-[9px] font-mono font-bold ${
                               cmd === 'HIGH' ? 'text-red-400' : cmd === 'LOW' ? 'text-yellow-400' : 'text-gray-500'
                            }`}>
                              NOZ-{idx + 1}: {cmd}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="w-full text-gray-400 text-sm">No nozzle data available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <footer className="text-center mt-12 pb-8 text-white/50 text-[10px] uppercase tracking-widest">
           Advanced Precision Agriculture Logic v1.0
        </footer>
      </div>
    </div>
  );
}

export default App;
