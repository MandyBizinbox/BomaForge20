import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../api';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, X } from 'lucide-react';
import { toast } from 'sonner';

export default function Allowance() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [walletDetail, setWalletDetail] = useState(null);
  const [pendingEntries, setPendingEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showSpendRequest, setShowSpendRequest] = useState(false);
  const [entryForm, setEntryForm] = useState({ child_id: '', type: 'credit', amount: '', reason: '', source_type: 'manual' });
  const [spendForm, setSpendForm] = useState({ amount: '', reason: '' });

  const isParent = user?.role === 'parent' || user?.role === 'superadmin';

  const fetchWallets = useCallback(async () => {
    try {
      const [w, p] = await Promise.all([
        API.get('/allowance/wallets'),
        isParent ? API.get('/allowance/pending') : Promise.resolve({ data: { entries: [] } })
      ]);
      setWallets(w.data.wallets);
      setPendingEntries(p.data.entries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isParent]);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);

  const openWallet = async (childId) => {
    setSelectedChild(childId);
    try {
      const res = await API.get(`/allowance/wallets/${childId}`);
      setWalletDetail(res.data);
    } catch (err) {
      toast.error('Failed to load wallet');
    }
  };

  const addEntry = async (e) => {
    e.preventDefault();
    try {
      await API.post('/allowance/entries', { ...entryForm, amount: parseFloat(entryForm.amount) });
      toast.success('Entry added');
      setShowAddEntry(false);
      setEntryForm({ child_id: '', type: 'credit', amount: '', reason: '', source_type: 'manual' });
      fetchWallets();
      if (selectedChild) openWallet(selectedChild);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const submitSpendRequest = async (e) => {
    e.preventDefault();
    try {
      await API.post('/allowance/spend-request', { amount: parseFloat(spendForm.amount), reason: spendForm.reason });
      toast.success('Spend request submitted');
      setShowSpendRequest(false);
      setSpendForm({ amount: '', reason: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const approveEntry = async (entryId, action) => {
    await API.post('/allowance/approve', { entry_id: entryId, action });
    toast.success(`Entry ${action}d`);
    fetchWallets();
    if (selectedChild) openWallet(selectedChild);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="animate-fade-in" data-testid="allowance-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Allowance</h1>
        <div className="flex gap-2">
          {isParent && (
            <button data-testid="add-entry-btn" onClick={() => setShowAddEntry(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={16} /> Add Entry
            </button>
          )}
          {!isParent && (
            <button data-testid="spend-request-btn" onClick={() => setShowSpendRequest(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <ArrowUpRight size={16} /> Spend Request
            </button>
          )}
        </div>
      </div>

      {/* Pending approvals */}
      {isParent && pendingEntries.length > 0 && (
        <div className="card-boma mb-6 border-[#F4C542]/30 bg-[#F4C542]/5" data-testid="pending-approvals">
          <h3 className="font-bold text-[#2A2A2A] mb-3 flex items-center gap-2">
            <Clock size={16} className="text-[#F4C542]" /> Pending Approvals ({pendingEntries.length})
          </h3>
          <div className="space-y-2">
            {pendingEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-xl">
                <div>
                  <p className="text-sm font-bold text-[#2A2A2A]">{entry.child_name} - R{entry.amount.toFixed(2)}</p>
                  <p className="text-xs text-[#2A2A2A]/40">{entry.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveEntry(entry.id, 'approve')} className="p-1.5 rounded-lg bg-[#88C477]/10 text-[#88C477] hover:bg-[#88C477]/20" data-testid={`approve-${entry.id}`}>
                    <CheckCircle2 size={16} />
                  </button>
                  <button onClick={() => approveEntry(entry.id, 'reject')} className="p-1.5 rounded-lg bg-[#E05A6D]/10 text-[#E05A6D] hover:bg-[#E05A6D]/20" data-testid={`reject-${entry.id}`}>
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wallet cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {wallets.map(w => (
          <button
            key={w.child_id}
            data-testid={`wallet-card-${w.child_id}`}
            onClick={() => openWallet(w.child_id)}
            className={`card-boma text-left cursor-pointer ${selectedChild === w.child_id ? 'ring-2 ring-[#2D4F3F]' : ''}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: w.avatar_color }}>
                {w.child_name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-[#2A2A2A]">{w.child_name}</p>
                {w.pending_count > 0 && <span className="text-xs text-[#F4C542] font-bold">{w.pending_count} pending</span>}
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-[#2A2A2A]/40 font-medium uppercase tracking-wider">Balance</p>
                <p className="text-2xl font-bold text-[#2D4F3F]">R{w.balance.toFixed(2)}</p>
              </div>
              <Wallet size={24} className="text-[#E8D5B5]" />
            </div>
          </button>
        ))}
        {wallets.length === 0 && (
          <div className="card-boma col-span-full text-center py-10">
            <Wallet size={48} className="text-[#E8D5B5] mx-auto mb-3" />
            <p className="text-[#2A2A2A]/40">No wallets yet. Add children to create wallets.</p>
          </div>
        )}
      </div>

      {/* Wallet detail */}
      {walletDetail && (
        <div className="card-boma" data-testid="wallet-detail">
          <h3 className="font-bold text-[#2A2A2A] mb-4" style={{fontFamily: 'Fraunces, serif'}}>
            {walletDetail.child.name}'s Ledger
          </h3>
          {walletDetail.entries.length === 0 ? (
            <p className="text-[#2A2A2A]/40 text-sm">No entries yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {walletDetail.entries.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-[#E8D5B5]/10">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${entry.type === 'credit' ? 'bg-[#88C477]/10' : 'bg-[#E05A6D]/10'}`}>
                    {entry.type === 'credit' ? <ArrowDownRight size={14} className="text-[#88C477]" /> : <ArrowUpRight size={14} className="text-[#E05A6D]" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#2A2A2A]">{entry.reason || entry.source_type}</p>
                    <p className="text-xs text-[#2A2A2A]/40">{new Date(entry.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${entry.type === 'credit' ? 'text-[#88C477]' : 'text-[#E05A6D]'}`}>
                      {entry.type === 'credit' ? '+' : '-'}R{entry.amount.toFixed(2)}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${entry.status === 'approved' ? 'bg-[#88C477]/10 text-[#88C477]' : entry.status === 'pending' ? 'bg-[#F4C542]/10 text-[#F4C542]' : 'bg-[#E05A6D]/10 text-[#E05A6D]'}`}>
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddEntry(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={addEntry} className="card-boma w-full max-w-md space-y-4" data-testid="add-entry-form">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Add Entry</h3>
              <button type="button" onClick={() => setShowAddEntry(false)}><X size={18} /></button>
            </div>
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Child</label>
              <select value={entryForm.child_id} onChange={e => setEntryForm({...entryForm, child_id: e.target.value})} className="input-boma" required>
                <option value="">Select child</option>
                {wallets.map(w => <option key={w.child_id} value={w.child_id}>{w.child_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Type</label>
                <select value={entryForm.type} onChange={e => setEntryForm({...entryForm, type: e.target.value})} className="input-boma">
                  <option value="credit">Credit (+)</option>
                  <option value="debit">Debit (-)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Amount (R)</label>
                <input type="number" step="0.01" min="0" value={entryForm.amount} onChange={e => setEntryForm({...entryForm, amount: e.target.value})} className="input-boma" required />
              </div>
            </div>
            <input type="text" value={entryForm.reason} onChange={e => setEntryForm({...entryForm, reason: e.target.value})} className="input-boma" placeholder="Reason" />
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Source</label>
              <select value={entryForm.source_type} onChange={e => setEntryForm({...entryForm, source_type: e.target.value})} className="input-boma">
                <option value="manual">Manual</option>
                <option value="allowance">Allowance</option>
                <option value="chore_reward">Chore Reward</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full" data-testid="add-entry-submit-btn">Add Entry</button>
          </form>
        </div>
      )}

      {/* Spend Request Modal */}
      {showSpendRequest && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSpendRequest(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submitSpendRequest} className="card-boma w-full max-w-md space-y-4" data-testid="spend-request-form">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Spend Request</h3>
              <button type="button" onClick={() => setShowSpendRequest(false)}><X size={18} /></button>
            </div>
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Amount (R)</label>
              <input type="number" step="0.01" min="0" value={spendForm.amount} onChange={e => setSpendForm({...spendForm, amount: e.target.value})} className="input-boma" required />
            </div>
            <input type="text" value={spendForm.reason} onChange={e => setSpendForm({...spendForm, reason: e.target.value})} className="input-boma" placeholder="What is it for?" required />
            <button type="submit" className="btn-secondary w-full" data-testid="spend-request-submit-btn">Submit Request</button>
          </form>
        </div>
      )}
    </div>
  );
}
