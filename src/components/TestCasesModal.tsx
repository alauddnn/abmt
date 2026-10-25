import React, { useState } from 'react';
import { X, CheckCircle, XCircle, Play, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';

interface TestCaseResult {
  caseNum: number;
  title: string;
  expected: string;
  actual: string;
  status: 'PASSED' | 'FAILED';
  details: any;
}

interface TestCasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const TestCasesModal: React.FC<TestCasesModalProps> = ({ isOpen, onClose, onDataChanged }) => {
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.runTestScenarios();
      setSummary(res.summary);
      setResults(res.results);
      setMsg({ type: 'success', text: 'Semua 8 skenario pengujian spesifikasi berhasil dijalankan!' });
      onDataChanged();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Gagal menjalankan pengujian' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    setResetLoading(true);
    setMsg(null);
    try {
      await api.resetTestScenarios();
      setSummary(null);
      setResults([]);
      setMsg({ type: 'success', text: 'Data transaksi berhasil dibersihkan kembali ke data awal 10 karyawan!' });
      onDataChanged();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Gagal mereset data' });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px] overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full overflow-hidden border border-[#EAECF0] animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#EAECF0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF3] text-[#16A36A] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#262626]">Pengujian 8 Skenario Operasional</h3>
              <p className="text-[11px] text-[#667085]">Verifikasi Perhitungan Gaji, Lembur, Kasbon, dan Biaya</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#667085] hover:text-[#262626] rounded-md hover:bg-[#F2F4F7] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="p-5 bg-[#F9FAFB] border-b border-[#EAECF0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRunTests}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#4693FD] hover:bg-[#357ee8] disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
            >
              <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Menjalankan...' : 'Jalankan 8 Skenario Pengujian'}
            </button>
            <button
              onClick={handleResetData}
              disabled={resetLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F9FAFB] disabled:opacity-50 text-[#344054] text-xs font-medium rounded-lg border border-[#D0D5DD] shadow-xs transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetLoading ? 'animate-spin' : ''}`} />
              {resetLoading ? 'Membersihkan...' : 'Reset ke Data Awal Perusahaan'}
            </button>
          </div>

          {summary && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#ECFDF3] text-[#16A36A] border border-[#D1FADF]">
              {summary}
            </span>
          )}
        </div>

        {msg && (
          <div className={`p-3.5 text-xs font-medium flex items-center gap-2 border-b ${
            msg.type === 'success' ? 'bg-[#ECFDF3] text-[#16A36A] border-[#D1FADF]' : 'bg-[#FEF3F2] text-[#D64545] border-[#FECDCA]'
          }`}>
            {msg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Content list */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
          {results.length === 0 ? (
            <div className="text-center py-10 text-[#667085] text-xs">
              <ShieldCheck className="w-8 h-8 text-[#98A2B3] mx-auto mb-2" />
              <p className="font-semibold text-[#262626]">Belum Ada Pengujian yang Dijalankan</p>
              <p className="text-[11px] text-[#667085] mt-1 max-w-md mx-auto">
                Klik tombol "Jalankan 8 Skenario Pengujian" di atas untuk menjalankan uji coba otomatis sesuai dokumen spesifikasi operasional.
              </p>
            </div>
          ) : (
            results.map((r) => (
              <div
                key={r.caseNum}
                className="p-4 rounded-lg border border-[#EAECF0] bg-white transition-all text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {r.status === 'PASSED' ? (
                      <CheckCircle className="w-4 h-4 text-[#16A36A] shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#D64545] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-[#262626] text-xs">
                        Kasus #{r.caseNum}: {r.title}
                      </p>
                      <div className="mt-1.5 space-y-1 text-[11px]">
                        <p className="text-[#667085]">
                          <span className="font-medium text-[#344054]">Ekspektasi:</span> {r.expected}
                        </p>
                        <p className="text-[#667085]">
                          <span className="font-medium text-[#344054]">Hasil Aktual:</span> {r.actual}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      r.status === 'PASSED'
                        ? 'bg-[#ECFDF3] text-[#16A36A]'
                        : 'bg-[#FEF3F2] text-[#D64545]'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#EAECF0] flex items-center justify-between text-xs text-[#667085]">
          <span>Gunakan tombol "Reset" setelah selesai pengujian untuk membersihkan data demo.</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white hover:bg-[#F2F4F7] text-[#344054] rounded-lg border border-[#D0D5DD] font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
