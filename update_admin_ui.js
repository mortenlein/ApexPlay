const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/TournamentManageClient.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Inject draftSeeds state
if (!content.includes('draftSeeds')) {
    content = content.replace(
        'const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);',
        'const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);\n    const [draftSeeds, setDraftSeeds] = useState<Record<string, number>>({});'
    );
}

// 2. Inject handleSaveSeeds
if (!content.includes('handleSaveSeeds')) {
    content = content.replace(
        'const onDragEnd = () => {',
        `const handleSaveSeeds = async () => {
        const payload = Object.entries(draftSeeds).map(([id, seed]) => ({ id, seed }));
        await Promise.all(payload.map(({ id, seed }) => 
            fetch(\`/api/teams/\${id}\`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seed }),
            })
        ));
        setDraftSeeds({});
        queryClient.invalidateQueries({ queryKey: ['teams', tournamentId] });
    };

    const onDragEnd = () => {`
    );
}

// 3. Inject Save Seeds button
if (!content.includes('handleSaveSeeds')) {
     // fallback if it didn't match
}
content = content.replace(
    '<span className="text-sm font-medium text-gray-400 bg-white/5 px-3 py-1 rounded-[8px]">{teams.length} total</span>',
    `<div className="flex items-center gap-2">
         {Object.keys(draftSeeds).length > 0 && (
             <button onClick={handleSaveSeeds} className="text-xs font-bold bg-[#4318FF] hover:bg-[#3965FF] text-white px-3 py-1.5 rounded-[8px] transition-all">Save Seeds</button>
         )}
         <span className="text-sm font-medium text-gray-400 bg-white/5 px-3 py-1 rounded-[8px]">{teams.length} total</span>
     </div>`
);

// 4. Update the seed box to be an input
content = content.replace(
    '<div className="flex flex-col items-center justify-center bg-white/5 w-8 h-8 rounded-[8px]">\n                                                            <span className="text-xs font-bold text-[#4318FF]">#{index + 1}</span>\n                                                        </div>',
    `<input 
        type="number"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
            const val = e.target.value === '' ? '' : Number(e.target.value);
            setDraftSeeds({...draftSeeds, [team.id]: val});
        }}
        value={draftSeeds[team.id] !== undefined ? draftSeeds[team.id] : (team.seed || index + 1)}
        className="w-10 h-8 bg-black/40 text-center rounded-[8px] border border-white/10 text-xs font-bold text-[#4318FF] focus:outline-none focus:border-[#4318FF] cursor-text pointer-events-auto"
    />`
);

// 5. Add Team Edit Modal at the bottom
if (!content.includes('TEAM SETTINGS MODAL')) {
    const modalJSX = `
            {/* TEAM SETTINGS MODAL */}
            {editingTeam && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setEditingTeam(null)}></div>
                    <div className="bg-[#0B1437] w-full max-w-4xl max-h-[90vh] rounded-[24px] border border-[#4318FF]/20 shadow-2xl relative z-10 flex flex-col overflow-hidden">
                        <header className="p-8 border-b border-white/5 flex items-start justify-between">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-[#111C44] rounded-[16px] flex items-center justify-center border border-white/5 shadow-md overflow-hidden relative">
                                    {editingTeam.logoUrl ? (
                                        <img src={editingTeam.logoUrl} alt="" className="object-contain w-full h-full p-2" />
                                    ) : (
                                        <Users size={24} className="text-[#4318FF] shadow-[0_0_15px_rgba(67,24,255,0.4)]" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tight">{editingTeam.name}</h2>
                                    <div className="text-xs font-bold text-[#4318FF] bg-[#4318FF]/10 px-3 py-1 rounded-full w-max mt-2 border border-[#4318FF]/20">
                                        Seed #{editingTeam.seed || 'Unseeded'}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setEditingTeam(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-[12px] transition-all text-gray-500 hover:text-white border border-white/5">
                                <X size={20} />
                            </button>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Registered Roster ({editingTeam.players?.length || 0})</h3>
                            <div className="space-y-4">
                                {editingTeam.players?.map((p: any, idx: number) => {
                                    const discordAccount = p.user?.accounts?.find((a: any) => a.provider === 'discord');
                                    return (
                                        <div key={idx} className="bg-[#111C44] border border-white/5 p-5 rounded-[16px] flex items-center justify-between hover:border-[#4318FF]/30 transition-all">
                                            <div className="flex items-center gap-5 relative">
                                                <div className="w-10 h-10 bg-[#4318FF]/10 rounded-[12px] flex items-center justify-center text-[#4318FF] font-bold text-xs border border-[#4318FF]/20 shadow-sm">
                                                    P{idx + 1}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-white text-base leading-none gap-2 flex items-center">
                                                        {p.nickname || p.name.split(' ')[0]} 
                                                        {discordAccount ? (
                                                            <span title="Discord Connected" className="bg-[#5865F2]/20 text-[#5865F2] text-[9px] px-2 py-0.5 rounded-full border border-[#5865F2]/30 uppercase font-black">Discord</span>
                                                        ) : (
                                                            <span className="text-gray-600 text-[9px] px-2 py-0.5 rounded-full border border-white/5 uppercase font-black">No Discord</span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs font-medium text-gray-500">{p.name}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {p.steamId ? (
                                                    <a href={\`https://steamcommunity.com/profiles/\${p.steamId}\`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-bold text-[#4318FF] bg-[#4318FF]/10 hover:bg-[#4318FF] hover:text-white px-4 py-2 rounded-[10px] transition-all border border-[#4318FF]/20 cursor-pointer">
                                                        <ExternalLink size={14} /> Steam Profile
                                                    </a>
                                                ) : (
                                                    <span className="text-xs font-medium text-gray-600 px-4 py-2 bg-white/5 rounded-[10px] border border-white/5">No Steam ID</span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                {(!editingTeam.players || editingTeam.players.length === 0) && (
                                    <div className="text-center py-10 border border-white/5 border-dashed rounded-[16px] opacity-70">
                                        <p className="text-sm font-medium text-gray-500">No players registered for this unit.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
`;
    content = content.replace('        </div>\n    );\n}', modalJSX);
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Script completed');
