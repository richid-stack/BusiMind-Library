const fs = require('fs');

// Patch App.tsx to remove the dark mode wrapper for other tabs and make them look integrated
let appContent = fs.readFileSync('src/App.tsx', 'utf-8');
appContent = appContent.replace(
  "className={activeTab === 'catalog' ? 'bg-transparent text-gray-900' : 'bg-[#0f111a] rounded-xl shadow-xl border border-slate-800/60 overflow-hidden text-slate-200'}",
  "className='bg-transparent text-[#0f1111]'"
);
fs.writeFileSync('src/App.tsx', appContent);

// Function to replace colors in a file
function refineComponent(file) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Replace dark mode backgrounds with clean light mode Amazon-esque ones
  content = content.replace(/bg-\[#151923\]/g, 'bg-white');
  content = content.replace(/bg-\[#0f111a\]/g, 'bg-white');
  content = content.replace(/bg-\[#0a0d14\]/g, 'bg-[#f8f9fa]');
  content = content.replace(/bg-slate-900\/50/g, 'bg-gray-50');
  content = content.replace(/bg-slate-900/g, 'bg-gray-100');
  content = content.replace(/bg-slate-800\/60/g, 'bg-gray-100');
  content = content.replace(/bg-slate-800/g, 'bg-gray-100');
  
  // Replace borders
  content = content.replace(/border-slate-800\/60/g, 'border-gray-200');
  content = content.replace(/border-slate-800/g, 'border-gray-200');
  content = content.replace(/border-slate-700\/50/g, 'border-gray-200');
  content = content.replace(/border-slate-700/g, 'border-gray-300');
  
  // Replace text colors
  content = content.replace(/text-slate-200/g, 'text-gray-900');
  content = content.replace(/text-slate-300/g, 'text-gray-800');
  content = content.replace(/text-slate-400/g, 'text-gray-600');
  content = content.replace(/text-slate-500/g, 'text-gray-500');
  
  // Replace specific AI/Generic colors with Amazon brand ones (f3a847, 131921, 232f3e)
  content = content.replace(/text-blue-400/g, 'text-[#007185]');
  content = content.replace(/text-blue-500/g, 'text-[#007185]');
  content = content.replace(/bg-blue-500\/10/g, 'bg-[#007185]/10');
  content = content.replace(/border-blue-500\/20/g, 'border-[#007185]/20');
  content = content.replace(/bg-blue-600/g, 'bg-[#232f3e]');
  content = content.replace(/shadow-blue-900\/20/g, 'shadow-sm');

  content = content.replace(/text-emerald-400/g, 'text-[#007600]');
  content = content.replace(/text-emerald-500/g, 'text-[#007600]');
  content = content.replace(/bg-emerald-500\/10/g, 'bg-[#007600]/10');
  content = content.replace(/border-emerald-500\/20/g, 'border-[#007600]/20');
  
  content = content.replace(/text-rose-400/g, 'text-[#B12704]');
  content = content.replace(/text-rose-500/g, 'text-[#B12704]');
  content = content.replace(/text-red-400/g, 'text-[#B12704]');
  content = content.replace(/bg-rose-500\/10/g, 'bg-[#B12704]/10');
  content = content.replace(/border-rose-500\/20/g, 'border-[#B12704]/20');

  content = content.replace(/text-amber-400/g, 'text-[#c45500]');
  content = content.replace(/text-amber-500/g, 'text-[#c45500]');
  content = content.replace(/bg-amber-500\/10/g, 'bg-[#f3a847]/10');
  content = content.replace(/border-amber-500\/20/g, 'border-[#f3a847]/30');
  
  content = content.replace(/text-indigo-400/g, 'text-[#007185]');
  content = content.replace(/text-indigo-500/g, 'text-[#007185]');
  content = content.replace(/bg-indigo-600/g, 'bg-[#131921]');
  content = content.replace(/hover:bg-indigo-700/g, 'hover:bg-[#232f3e]');
  
  // Chip wrap fixes
  content = content.replace(/className="flex flex-wrap items-center gap-1.5"/g, 'className="flex flex-wrap items-center gap-1.5 overflow-hidden"');
  
  fs.writeFileSync(file, content);
}

['src/components/ValuationLab.tsx', 'src/components/MacroIntelligenceView.tsx', 'src/components/PeerComparisonScreenerView.tsx', 'src/components/PortfolioStressView.tsx', 'src/components/AcademicLibraryView.tsx', 'src/components/AnalyticsView.tsx', 'src/components/SetupAssistant.tsx'].forEach(file => {
  if (fs.existsSync(file)) {
    refineComponent(file);
  }
});
