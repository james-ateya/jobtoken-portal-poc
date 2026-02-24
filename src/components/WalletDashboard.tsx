import { Wallet, Plus, RefreshCw, History, Calendar, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

interface Transaction {
  id: string;
  tokens_added: number;
  type: string;
  reference_id: string;
  created_at: string;
}

interface WalletDashboardProps {
  balance: number;
  onTopup: () => void;
  isTopupLoading?: boolean;
  userId: string;
  expiresAt?: string | null;
}

export function WalletDashboard({ balance, onTopup, isTopupLoading, userId, expiresAt }: WalletDashboardProps) {
  const [activeTab, setActiveTab] = useState<'wallet' | 'history'>('wallet');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data: wallet } = await supabase.from('wallets').select('id').eq('user_id', userId).single();
    if (wallet) {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setTransactions(data);
    }
    setLoadingHistory(false);
  };

  return (
    <div className="p-8 rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black shadow-2xl relative overflow-hidden min-h-[400px]">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => setActiveTab('wallet')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === 'wallet' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
              )}
            >
              Wallet
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === 'history' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
              )}
            >
              History
            </button>
          </div>
          
          {activeTab === 'wallet' && (
            <div className={cn(
              "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border",
              isExpired 
                ? "bg-red-500/10 text-red-400 border-red-500/20" 
                : "bg-white/5 text-zinc-500 border-white/5"
            )}>
              <Calendar className="w-3 h-3" />
              {isExpired ? "Tokens Expired" : expiryDate ? `Expires ${expiryDate}` : "30-Day Validity"}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'wallet' ? (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="flex items-center gap-3 text-zinc-400 mb-4">
                <Wallet className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Current Balance</span>
              </div>

              <div className="flex items-end gap-3 mb-8">
                <motion.span 
                  key={balance}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={cn(
                    "text-6xl font-bold tracking-tighter",
                    isExpired ? "text-red-400 opacity-50" : "text-white"
                  )}
                >
                  {balance}
                </motion.span>
                <span className="text-zinc-500 text-xl font-medium mb-2">Tokens</span>
              </div>

              {(balance === 0 || isExpired) && (
                <div className={cn(
                  "mb-8 p-4 rounded-2xl border",
                  isExpired ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20"
                )}>
                  <p className={cn(
                    "text-sm font-medium",
                    isExpired ? "text-red-400" : "text-emerald-400"
                  )}>
                    {isExpired 
                      ? "Your account has expired. Top up to reactivate your tokens." 
                      : "Top up Ksh 100 to start applying for jobs!"}
                  </p>
                </div>
              )}

              <button
                onClick={onTopup}
                disabled={isTopupLoading}
                className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-500 text-black rounded-2xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                {isTopupLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                Pay via M-Pesa (Ksh 100)
              </button>
              
              <p className="mt-6 text-[10px] text-zinc-500 text-center uppercase tracking-widest font-bold opacity-50">
                Secure Payment via Daraja API Simulation
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Fetching Ledger...</span>
                </div>
              ) : transactions.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          tx.tokens_added > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        )}>
                          {tx.tokens_added > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-wider">{tx.type}</p>
                          <p className="text-[10px] text-zinc-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-sm font-bold",
                          tx.tokens_added > 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {tx.tokens_added > 0 ? '+' : ''}{tx.tokens_added}
                        </p>
                        <p className="text-[9px] text-zinc-600 font-mono">{tx.reference_id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-500 text-sm">No transaction history found.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

import { cn } from "../lib/utils";
