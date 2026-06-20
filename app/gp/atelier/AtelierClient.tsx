'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── types ───────────────────────────────────────────────────────────────────

interface Intervention {
  id: number; vehicleId: number; email: string;
  status: 'planifie' | 'en_cours' | 'termine' | 'facture' | null;
  type: string | null; description: string | null; mecanicNotes: string | null;
  estimatedCost: number | null; realCost: number | null; estimatedDuration: number | null;
  startDate: string | null; endDate: string | null; aiRecommendations: string | null;
  createdAt: string | null; updatedAt: string | null;
}
interface Vehicle { id: number; make: string | null; model: string | null; year: number | null; status: string | null; }
interface Rdv {
  id: number; vehicleId: number | null; type: string; status: string | null;
  scheduledAt: string; durationMinutes: number | null;
  customerName: string | null; customerPhone: string | null; customerEmail: string | null;
  notes: string | null;
}
interface Piece {
  id: number; interventionId: number; pieceName: string; partNumber: string | null;
  supplier: string | null; estimatedPrice: number | null; quantity: number | null;
  status: 'a_commander' | 'commande' | 'recu' | 'monte' | null;
}

const BLANK_RDV = {
  type: 'intervention', vehicleId: '', customerName: '', customerPhone: '', customerEmail: '',
  scheduledAt: '', durationMinutes: '60', notes: '',
};
const BLANK_PIECE = { pieceName: '', partNumber: '', supplier: '', estimatedPrice: '', quantity: '1' };

const STATUS_FLOW: Array<Intervention['status']> = ['planifie', 'en_cours', 'termine', 'facture'];
const STATUS_LABELS: Record<string, string> = {
  planifie: 'Planifié', en_cours: 'En cours', termine: 'Terminé', facture: 'Facturé',
};
const STATUS_COLORS: Record<string, string> = {
  planifie: 'text-zinc-400 border-zinc-700', en_cours: 'text-blue-300 border-blue-800',
  termine: 'text-green-300 border-green-800', facture: 'text-purple-300 border-purple-800',
};
const TYPE_ICONS: Record<string, string> = {
  revision: '🔧', reparation: '🛠️', preparation_vente: '✨', diagnostic: '🔍', autre: '📋',
};
const TYPE_LABELS: Record<string, string> = {
  revision: 'Révision', reparation: 'Réparation', preparation_vente: 'Prép. vente',
  diagnostic: 'Diagnostic', autre: 'Autre',
};
const RDV_TYPE_LABELS: Record<string, string> = {
  diagnostic: 'Diagnostic', intervention: 'Intervention',
  livraison: 'Livraison', reprise_trade_in: 'Reprise', essai: 'Essai',
};
const PIECE_STATUS_LABELS: Record<string, string> = {
  a_commander: 'À commander', commande: 'Commandée', recu: 'Reçue', monte: 'Montée',
};
const PIECE_STATUS_NEXT: Record<string, string> = {
  a_commander: 'commande', commande: 'recu', recu: 'monte',
};

const inputCls = 'w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 placeholder-zinc-600';
const textareaCls = 'w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 placeholder-zinc-600 resize-y';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' });
}
function fmtDateTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-BE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtEur(n: number | null) { return n != null ? `${n.toLocaleString('fr-BE')} €` : '—'; }

export default function AtelierClient() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [piecesMap, setPiecesMap] = useState<Record<number, Piece[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showRdvForm, setShowRdvForm] = useState(false);
  const [rdvForm, setRdvForm] = useState(BLANK_RDV);
  const [creatingRdv, setCreatingRdv] = useState(false);
  const [pieceFormId, setPieceFormId] = useState<number | null>(null);
  const [pieceForm, setPieceForm] = useState(BLANK_PIECE);
  const [addingPiece, setAddingPiece] = useState(false);
  const [editNotes, setEditNotes] = useState<Record<number, string>>({});
  const [editCost, setEditCost] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const vehicleMap = new Map(vehicles.map(v => [v.id, v]));
  const vehicleLabel = (id: number) => { const v = vehicleMap.get(id); return v ? `${v.make ?? ''} ${v.model ?? ''} ${v.year ?? ''}`.trim() : `Véhicule #${id}`; };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [intRes, vRes, rdvRes] = await Promise.all([
      fetch('/api/atelier/interventions'),
      fetch('/api/agents/vehicle'),
      fetch('/api/atelier/rdvs?days=14'),
    ]);
    const [intData, vData, rdvData] = await Promise.all([intRes.json(), vRes.json(), rdvRes.json()]);
    setInterventions(intData.interventions ?? []);
    setVehicles(vData.vehicles ?? []);
    setRdvs(rdvData.rdvs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadPieces = async (interventionId: number) => {
    const res = await fetch(`/api/atelier/pieces?interventionId=${interventionId}`);
    const data = await res.json();
    setPiecesMap(m => ({ ...m, [interventionId]: data.pieces ?? [] }));
  };

  const handleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!piecesMap[id]) loadPieces(id);
  };

  const handleStatusNext = async (intervention: Intervention) => {
    const cur = STATUS_FLOW.indexOf(intervention.status ?? 'planifie');
    if (cur >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[cur + 1];
    await fetch('/api/atelier/interventions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: intervention.id, status: next }),
    });
    await loadAll();
  };

  const handleSave = async (id: number) => {
    setSavingId(id);
    const body: Record<string, unknown> = { action: 'update', id };
    if (editNotes[id] !== undefined) body.mecanicNotes = editNotes[id];
    if (editCost[id] !== undefined && editCost[id] !== '') body.realCost = Number(editCost[id]);
    await fetch('/api/atelier/interventions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setSavingId(null);
    await loadAll();
  };

  const handleAddPiece = async (interventionId: number) => {
    if (!pieceForm.pieceName) return;
    setAddingPiece(true);
    await fetch('/api/atelier/pieces', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interventionId, pieceName: pieceForm.pieceName,
        partNumber: pieceForm.partNumber || null, supplier: pieceForm.supplier || null,
        estimatedPrice: pieceForm.estimatedPrice ? Number(pieceForm.estimatedPrice) : null,
        quantity: Number(pieceForm.quantity) || 1,
      }),
    });
    setAddingPiece(false);
    setPieceForm(BLANK_PIECE);
    setPieceFormId(null);
    await loadPieces(interventionId);
  };

  const handlePieceAdvance = async (piece: Piece) => {
    const next = PIECE_STATUS_NEXT[piece.status ?? 'a_commander'];
    if (!next) return;
    await fetch('/api/atelier/pieces', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', id: piece.id, status: next }),
    });
    await loadPieces(piece.interventionId);
  };

  const handleCreateRdv = async () => {
    if (!rdvForm.scheduledAt) return;
    setCreatingRdv(true);
    await fetch('/api/atelier/rdvs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: rdvForm.type, scheduledAt: rdvForm.scheduledAt,
        vehicleId: rdvForm.vehicleId ? Number(rdvForm.vehicleId) : null,
        customerName: rdvForm.customerName || null, customerPhone: rdvForm.customerPhone || null,
        customerEmail: rdvForm.customerEmail || null, durationMinutes: Number(rdvForm.durationMinutes),
        notes: rdvForm.notes || null,
      }),
    });
    setCreatingRdv(false);
    setRdvForm(BLANK_RDV);
    setShowRdvForm(false);
    await loadAll();
  };

  const kanban: Record<string, Intervention[]> = {
    planifie: interventions.filter(i => i.status === 'planifie'),
    en_cours: interventions.filter(i => i.status === 'en_cours'),
    termine: interventions.filter(i => i.status === 'termine'),
    facture: interventions.filter(i => i.status === 'facture'),
  };

  const totalCost = interventions.filter(i => i.realCost != null).reduce((s, i) => s + (i.realCost ?? 0), 0);
  const piecesToOrder = Object.values(piecesMap).flat().filter(p => p.status === 'a_commander');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Atelier — Agent Mécanique & RDV</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Interventions, pièces, rendez-vous</p>
        </div>
        <button
          onClick={() => setShowRdvForm(v => !v)}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 text-sm font-semibold rounded-lg hover:bg-white transition-colors self-start sm:self-auto"
        >
          {showRdvForm ? '✕ Annuler' : '+ Nouveau RDV'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'En cours', value: kanban.en_cours.length, color: 'text-blue-300' },
          { label: 'Planifiées', value: kanban.planifie.length, color: '' },
          { label: 'RDV (14j)', value: rdvs.length, color: '' },
          { label: 'Coût atelier', value: totalCost > 0 ? `${totalCost.toLocaleString('fr-BE')} €` : '—', color: '' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className={`text-2xl font-bold ${s.color || 'text-zinc-100'}`}>{s.value}</div>
            <div className="text-xs text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* New RDV form */}
      {showRdvForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300">Nouveau rendez-vous</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Type *</label>
              <select className={inputCls} value={rdvForm.type} onChange={e => setRdvForm(f => ({ ...f, type: e.target.value }))}>
                {Object.entries(RDV_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Date & heure *</label>
              <input type="datetime-local" className={inputCls} value={rdvForm.scheduledAt} onChange={e => setRdvForm(f => ({ ...f, scheduledAt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Durée</label>
              <select className={inputCls} value={rdvForm.durationMinutes} onChange={e => setRdvForm(f => ({ ...f, durationMinutes: e.target.value }))}>
                <option value="30">30 min</option><option value="60">1h</option>
                <option value="90">1h30</option><option value="120">2h</option>
                <option value="180">3h</option><option value="480">Journée</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Véhicule</label>
              <select className={inputCls} value={rdvForm.vehicleId} onChange={e => setRdvForm(f => ({ ...f, vehicleId: e.target.value }))}>
                <option value="">— Aucun —</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} {v.year}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Nom client</label>
              <input className={inputCls} placeholder="Martin Dupont" value={rdvForm.customerName} onChange={e => setRdvForm(f => ({ ...f, customerName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Téléphone</label>
              <input className={inputCls} placeholder="0471 12 34 56" value={rdvForm.customerPhone} onChange={e => setRdvForm(f => ({ ...f, customerPhone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Email (rappel auto)</label>
              <input type="email" className={inputCls} placeholder="client@email.be" value={rdvForm.customerEmail} onChange={e => setRdvForm(f => ({ ...f, customerEmail: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Notes</label>
            <textarea className={textareaCls} rows={2} value={rdvForm.notes} onChange={e => setRdvForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateRdv} disabled={creatingRdv || !rdvForm.scheduledAt} className="px-4 py-2 bg-zinc-100 text-zinc-900 text-sm font-semibold rounded-lg hover:bg-white disabled:opacity-50 transition-colors">
              {creatingRdv ? 'Création...' : 'Créer le RDV'}
            </button>
            <button onClick={() => setShowRdvForm(false)} className="px-4 py-2 bg-zinc-800 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors">Annuler</button>
          </div>
        </div>
      )}

      {/* Kanban */}
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Interventions</h2>
        {loading ? (
          <div className="text-center py-8 text-zinc-600">Chargement...</div>
        ) : interventions.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-sm">
            Aucune intervention. Les interventions sont créées automatiquement quand un véhicule est marqué &quot;Acheté&quot; dans le Stock.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {(STATUS_FLOW as string[]).map(col => (
              <div key={col} className="space-y-2">
                <div className={`text-xs font-semibold uppercase tracking-wider ${STATUS_COLORS[col].split(' ')[0]}`}>
                  {STATUS_LABELS[col]} ({kanban[col].length})
                </div>
                {kanban[col].length === 0 && (
                  <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-4 text-center text-zinc-700 text-xs">Aucune</div>
                )}
                {kanban[col].map(inv => {
                  const isExp = expandedId === inv.id;
                  const pieces = piecesMap[inv.id] ?? [];
                  const curIdx = STATUS_FLOW.indexOf(inv.status ?? 'planifie');
                  return (
                    <div key={inv.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                      <button
                        className="w-full text-left p-3 hover:bg-zinc-800/50 transition-colors"
                        onClick={() => handleExpand(inv.id)}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base flex-shrink-0">{TYPE_ICONS[inv.type ?? ''] ?? '📋'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-200 truncate">{vehicleLabel(inv.vehicleId)}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">{TYPE_LABELS[inv.type ?? ''] ?? inv.type}</div>
                            {inv.estimatedCost != null && (
                              <div className="text-xs text-zinc-500 mt-0.5">
                                Estimé : {fmtEur(inv.estimatedCost)}
                                {inv.realCost != null && ` · Réel : ${fmtEur(inv.realCost)}`}
                              </div>
                            )}
                          </div>
                          <span className="text-zinc-600 text-xs">{isExp ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {isExp && (
                        <div className="border-t border-zinc-800 p-3 space-y-3 text-sm">
                          {/* Status advance */}
                          {curIdx < STATUS_FLOW.length - 1 && (
                            <button
                              onClick={() => handleStatusNext(inv)}
                              className="w-full py-1.5 text-xs bg-blue-950 border border-blue-800 text-blue-300 rounded-lg hover:bg-blue-900 transition-colors"
                            >
                              Passer à → {STATUS_LABELS[STATUS_FLOW[curIdx + 1] ?? '']}
                            </button>
                          )}

                          {/* Description / AI reco */}
                          {inv.description && <p className="text-xs text-zinc-400 leading-relaxed">{inv.description}</p>}
                          {inv.aiRecommendations && (
                            <div className="bg-zinc-800 rounded p-2 text-xs text-zinc-400">{inv.aiRecommendations}</div>
                          )}

                          {/* Notes mécanicien */}
                          <div>
                            <label className="text-xs text-zinc-500 block mb-1">Notes mécanicien</label>
                            <textarea
                              className={textareaCls}
                              rows={2}
                              defaultValue={inv.mecanicNotes ?? ''}
                              onChange={e => setEditNotes(n => ({ ...n, [inv.id]: e.target.value }))}
                              placeholder="Observations, pièces changées..."
                            />
                          </div>

                          {/* Real cost */}
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="text-xs text-zinc-500 block mb-1">Coût réel (€)</label>
                              <input
                                type="number"
                                className={inputCls}
                                defaultValue={inv.realCost ?? ''}
                                placeholder={inv.estimatedCost ? `Estimé : ${inv.estimatedCost}` : '0'}
                                onChange={e => setEditCost(c => ({ ...c, [inv.id]: e.target.value }))}
                              />
                            </div>
                            <button
                              onClick={() => handleSave(inv.id)}
                              disabled={savingId === inv.id}
                              className="px-3 py-1.5 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 disabled:opacity-60 transition-colors whitespace-nowrap"
                            >
                              {savingId === inv.id ? '⏳' : '✓ Sauver'}
                            </button>
                          </div>

                          {/* Pieces list */}
                          {pieces.length > 0 && (
                            <div>
                              <div className="text-xs text-zinc-500 mb-1.5">Pièces ({pieces.length})</div>
                              <div className="space-y-1">
                                {pieces.map(p => (
                                  <div key={p.id} className="flex items-center gap-2 text-xs">
                                    <span className="flex-1 text-zinc-300 truncate">{p.pieceName}</span>
                                    <span className="text-zinc-600 flex-shrink-0">{p.supplier}</span>
                                    {p.estimatedPrice && <span className="text-zinc-500 flex-shrink-0">{p.estimatedPrice}€</span>}
                                    <span className="text-zinc-600 flex-shrink-0">{PIECE_STATUS_LABELS[p.status ?? 'a_commander']}</span>
                                    {p.status !== 'monte' && (
                                      <button
                                        onClick={() => handlePieceAdvance(p)}
                                        className="px-1.5 py-0.5 bg-zinc-700 text-zinc-400 rounded text-xs hover:bg-zinc-600 flex-shrink-0"
                                      >→</button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Add piece form */}
                          {pieceFormId === inv.id ? (
                            <div className="space-y-2">
                              <div className="text-xs text-zinc-500">Ajouter une pièce</div>
                              <div className="grid grid-cols-2 gap-2">
                                <input className={inputCls} placeholder="Pièce *" value={pieceForm.pieceName} onChange={e => setPieceForm(f => ({ ...f, pieceName: e.target.value }))} />
                                <input className={inputCls} placeholder="Fournisseur" value={pieceForm.supplier} onChange={e => setPieceForm(f => ({ ...f, supplier: e.target.value }))} />
                                <input className={inputCls} placeholder="Référence" value={pieceForm.partNumber} onChange={e => setPieceForm(f => ({ ...f, partNumber: e.target.value }))} />
                                <input type="number" className={inputCls} placeholder="Prix €" value={pieceForm.estimatedPrice} onChange={e => setPieceForm(f => ({ ...f, estimatedPrice: e.target.value }))} />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleAddPiece(inv.id)} disabled={addingPiece || !pieceForm.pieceName} className="px-3 py-1 text-xs bg-zinc-100 text-zinc-900 font-semibold rounded hover:bg-white disabled:opacity-50 transition-colors">
                                  {addingPiece ? '...' : 'Ajouter'}
                                </button>
                                <button onClick={() => { setPieceFormId(null); setPieceForm(BLANK_PIECE); }} className="px-3 py-1 text-xs bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors">Annuler</button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setPieceFormId(inv.id); if (!piecesMap[inv.id]) loadPieces(inv.id); }}
                              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              + Ajouter une pièce à commander
                            </button>
                          )}

                          <div className="text-xs text-zinc-700">
                            Créé {fmtDate(inv.createdAt)}
                            {inv.startDate && ` · Démarré ${fmtDate(inv.startDate)}`}
                            {inv.endDate && ` · Terminé ${fmtDate(inv.endDate)}`}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming RDVs */}
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          RDV — 14 prochains jours ({rdvs.length})
        </h2>
        {rdvs.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center text-zinc-600 text-sm">Aucun RDV planifié</div>
        ) : (
          <div className="space-y-2">
            {rdvs.map(rdv => (
              <div key={rdv.id} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="font-medium text-zinc-200 text-sm whitespace-nowrap">{fmtDateTime(rdv.scheduledAt)}</div>
                <div className="flex-1 text-sm">
                  <span className="text-zinc-400">{RDV_TYPE_LABELS[rdv.type] ?? rdv.type}</span>
                  {rdv.customerName && <span className="text-zinc-500"> · {rdv.customerName}</span>}
                  {rdv.customerPhone && <span className="text-zinc-600"> · <a href={`tel:${rdv.customerPhone}`} className="text-blue-400">{rdv.customerPhone}</a></span>}
                  {rdv.vehicleId && vehicleMap.get(rdv.vehicleId) && (
                    <span className="text-zinc-600"> · {vehicleLabel(rdv.vehicleId)}</span>
                  )}
                </div>
                <div className="text-xs text-zinc-600">{rdv.durationMinutes} min</div>
                {rdv.customerEmail && (
                  <span className="text-xs text-green-600">✓ Rappel auto</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pieces to order summary */}
      {Object.keys(piecesMap).length > 0 && piecesToOrder.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Pièces à commander ({piecesToOrder.length})
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase">
                    <th className="px-4 py-2 text-left">Pièce</th>
                    <th className="px-4 py-2 text-left">Fournisseur</th>
                    <th className="px-4 py-2 text-right">Qté</th>
                    <th className="px-4 py-2 text-right">Prix est.</th>
                    <th className="px-4 py-2 text-right">Intervention</th>
                  </tr>
                </thead>
                <tbody>
                  {piecesToOrder.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-950'}>
                      <td className="px-4 py-2.5 text-zinc-200">{p.pieceName}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{p.supplier ?? '—'}</td>
                      <td className="px-4 py-2.5 text-zinc-400 text-right">{p.quantity ?? 1}</td>
                      <td className="px-4 py-2.5 text-zinc-300 text-right">{fmtEur(p.estimatedPrice)}</td>
                      <td className="px-4 py-2.5 text-zinc-600 text-right text-xs">{vehicleLabel(interventions.find(i => i.id === p.interventionId)?.vehicleId ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-800">
                    <td colSpan={3} className="px-4 py-2 text-xs text-zinc-500">Total estimé</td>
                    <td className="px-4 py-2 text-right font-semibold text-zinc-200">
                      {piecesToOrder.filter(p => p.estimatedPrice != null).reduce((s, p) => s + (p.estimatedPrice ?? 0) * (p.quantity ?? 1), 0).toLocaleString('fr-BE')} €
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
