import React, { useState, useEffect, useCallback } from 'react';
import API from '../../api';
import { BarChart3, Download, FileText, TrendingUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Reports() {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [report, setReport] = useState(null);
  const [choreReport, setChoreReport] = useState(null);
  const [allowanceReport, setAllowanceReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchChildren = useCallback(async () => {
    try {
      const res = await API.get('/children');
      setChildren(res.data.children);
      if (res.data.children.length > 0) {
        setSelectedChild(res.data.children[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  useEffect(() => {
    if (!selectedChild) return;
    const fetchReports = async () => {
      try {
        const [school, chores, allowance] = await Promise.all([
          API.get(`/reports/school/${selectedChild}`),
          API.get(`/reports/chores/${selectedChild}`),
          API.get(`/reports/allowance/${selectedChild}`)
        ]);
        setReport(school.data);
        setChoreReport(chores.data);
        setAllowanceReport(allowance.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchReports();
  }, [selectedChild]);

  const downloadCSV = () => {
    const token = localStorage.getItem('boma_token');
    window.open(`${BACKEND_URL}/api/reports/school/${selectedChild}/csv?token=${token}`, '_blank');
  };

  const downloadPDF = () => {
    const token = localStorage.getItem('boma_token');
    window.open(`${BACKEND_URL}/api/reports/school/${selectedChild}/pdf?token=${token}`, '_blank');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="animate-fade-in" data-testid="reports-page">
      <h1 className="text-3xl font-bold text-[#2A2A2A] mb-6" style={{fontFamily: 'Fraunces, serif'}}>Reports</h1>

      {/* Child selector */}
      {children.length > 0 ? (
        <div className="flex gap-2 mb-6 flex-wrap">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors duration-200 flex items-center gap-2 ${selectedChild === child.id ? 'bg-[#2D4F3F] text-white' : 'bg-white text-[#2A2A2A]/60 border border-[#E8D5B5]/50'}`}
            >
              <div className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center text-white font-bold" style={{ backgroundColor: child.avatar_color }}>
                {child.name.charAt(0)}
              </div>
              {child.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="card-boma text-center py-10">
          <BarChart3 size={48} className="text-[#E8D5B5] mx-auto mb-3" />
          <p className="text-[#2A2A2A]/40">Add children to see reports</p>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-boma text-center">
              <p className="text-xs text-[#2A2A2A]/40 font-medium uppercase tracking-wider mb-1">Total Lessons</p>
              <p className="text-2xl font-bold text-[#2D4F3F]">{report.summary.total}</p>
            </div>
            <div className="card-boma text-center">
              <p className="text-xs text-[#2A2A2A]/40 font-medium uppercase tracking-wider mb-1">Completed</p>
              <p className="text-2xl font-bold text-[#88C477]">{report.summary.done}</p>
            </div>
            <div className="card-boma text-center">
              <p className="text-xs text-[#2A2A2A]/40 font-medium uppercase tracking-wider mb-1">Pending</p>
              <p className="text-2xl font-bold text-[#F4C542]">{report.summary.pending}</p>
            </div>
            <div className="card-boma text-center">
              <p className="text-xs text-[#2A2A2A]/40 font-medium uppercase tracking-wider mb-1">Completion Rate</p>
              <p className="text-2xl font-bold text-[#C06C47]">{report.summary.completion_rate}%</p>
            </div>
          </div>

          {/* By Subject */}
          <div className="card-boma">
            <h3 className="font-bold text-[#2A2A2A] mb-4" style={{fontFamily: 'Fraunces, serif'}}>By Subject</h3>
            <div className="space-y-3">
              {Object.entries(report.by_subject).map(([name, data]) => {
                const pct = data.total > 0 ? Math.round(data.done / data.total * 100) : 0;
                return (
                  <div key={name} data-testid={`subject-report-${name}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
                        <span className="text-sm font-bold text-[#2A2A2A]">{name}</span>
                      </div>
                      <span className="text-sm text-[#2A2A2A]/50">{data.done}/{data.total} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-[#E8D5B5]/30 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: data.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chores & Allowance summaries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {choreReport && (
              <div className="card-boma" data-testid="chore-report">
                <h3 className="font-bold text-[#2A2A2A] mb-4 flex items-center gap-2" style={{fontFamily: 'Fraunces, serif'}}>
                  <TrendingUp size={18} className="text-[#C06C47]" /> Chores Summary
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#E8D5B5]/20 p-3 rounded-xl text-center">
                    <p className="text-xs text-[#2A2A2A]/40">Done</p>
                    <p className="text-xl font-bold text-[#88C477]">{choreReport.done}</p>
                  </div>
                  <div className="bg-[#E8D5B5]/20 p-3 rounded-xl text-center">
                    <p className="text-xs text-[#2A2A2A]/40">Rate</p>
                    <p className="text-xl font-bold text-[#2D4F3F]">{choreReport.completion_rate}%</p>
                  </div>
                  <div className="bg-[#E8D5B5]/20 p-3 rounded-xl text-center col-span-2">
                    <p className="text-xs text-[#2A2A2A]/40">Points Earned</p>
                    <p className="text-xl font-bold text-[#F4C542]">{choreReport.total_points}</p>
                  </div>
                </div>
              </div>
            )}
            {allowanceReport && (
              <div className="card-boma" data-testid="allowance-report">
                <h3 className="font-bold text-[#2A2A2A] mb-4 flex items-center gap-2" style={{fontFamily: 'Fraunces, serif'}}>
                  <TrendingUp size={18} className="text-[#2D4F3F]" /> Allowance Summary
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#88C477]/10 p-3 rounded-xl text-center">
                    <p className="text-xs text-[#2A2A2A]/40">Credits</p>
                    <p className="text-xl font-bold text-[#88C477]">R{allowanceReport.total_credits.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#E05A6D]/10 p-3 rounded-xl text-center">
                    <p className="text-xs text-[#2A2A2A]/40">Debits</p>
                    <p className="text-xl font-bold text-[#E05A6D]">R{allowanceReport.total_debits.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#E8D5B5]/20 p-3 rounded-xl text-center col-span-2">
                    <p className="text-xs text-[#2A2A2A]/40">Net Balance</p>
                    <p className="text-xl font-bold text-[#2D4F3F]">R{allowanceReport.net.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="flex gap-3">
            <button data-testid="export-csv-btn" onClick={downloadCSV} className="btn-primary flex items-center gap-2 text-sm">
              <Download size={16} /> Export CSV
            </button>
            <button data-testid="export-pdf-btn" onClick={downloadPDF} className="btn-secondary flex items-center gap-2 text-sm">
              <FileText size={16} /> Export PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
