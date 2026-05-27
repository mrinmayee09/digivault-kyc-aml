// src/components/portals/user/AMLSimulator.jsx
// Wired to POST /api/simulate-txn + GET /api/transactions
// Features: Real-time ledger, GPay inline validation, KYC enforcement, smart history routing

import { useState, useEffect } from "react";
import { User, CreditCard, DollarSign, Zap, Loader2, RefreshCw, Wallet, AlertCircle, Lock } from "lucide-react";
import { Panel, SectionHeader, Badge } from "../../shared";
import { api } from "../../../utils/api";
import { useApp } from "../../../context/AppContext";
import { formatINR } from "../../../utils/helpers";

const FORM_FIELDS = [
  { key: "receiver_name",  label: "Receiver Name",  placeholder: "e.g. Riya Mehta",  icon: User,       type: "text"   },
  { key: "account_number", label: "Account Number", placeholder: "e.g. 987654321012", icon: CreditCard, type: "text"   },
  { key: "amount",         label: "Amount (₹)",     placeholder: "e.g. 50000",        icon: DollarSign, type: "number" },
];

export default function AMLSimulator() {
  const { currentUser } = useApp();

  // Generate the current user's unique account number
  const myAccountNumber = currentUser?.user_id ? `98765432100${currentUser.user_id}` : "";

  const [transactions, setTransactions] = useState([]);
  const [form,         setForm]         = useState({ receiver_name: "", account_number: "", amount: "" });
  const [errors,       setErrors]       = useState({ receiver_name: "", account_number: "", amount: "" });
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [serverError,  setServerError]  = useState("");

  // Real-time banking state - Starts with 10 Lakhs
  const [accountBalance, setAccountBalance] = useState(1000000);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!currentUser?.user_id) return;
    setLoading(true);
    try {
      const data = await api.getTransactions(currentUser.user_id);
      setTransactions(data.transactions || []);
      
      // Calculate real balance from approved transactions
      let currentBalance = 1000000;
      if (data.transactions) {
        data.transactions.forEach(t => {
          if (t.status === "APPROVED" || t.is_flagged === false) {
            // Incoming money
            if (t.account_number === myAccountNumber) {
              currentBalance += parseFloat(t.amount);
            } 
            // Outgoing money
            else if (t.sender_id === currentUser.user_id) {
              currentBalance -= parseFloat(t.amount);
            }
          }
        });
      }
      setAccountBalance(currentBalance);
    } catch (e) {
      console.error("Failed to load transactions:", e.message);
    } finally {
      setLoading(false);
    }
  };

  // Real-time validation as the user types
  const handleInputChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    let errorMsg = "";

    if (key === "receiver_name" && value.length > 0 && value.length < 3) {
      errorMsg = "Name must be at least 3 characters.";
    } 
    else if (key === "account_number" && value.length > 0 && !/^\d{9,18}$/.test(value)) {
      errorMsg = "Must be 9 to 18 digits.";
    } 
    else if (key === "amount" && value.length > 0) {
      const num = parseFloat(value);
      if (num <= 0) errorMsg = "Amount must be greater than ₹0.";
      else if (num > accountBalance) errorMsg = "Insufficient balance.";
    }

    setErrors(prev => ({ ...prev, [key]: errorMsg }));
  };

  // Check if form is completely valid to enable the submit button
  const isFormValid = 
    form.receiver_name.length >= 3 && 
    /^\d{9,18}$/.test(form.account_number) && 
    parseFloat(form.amount) > 0 && 
    parseFloat(form.amount) <= accountBalance;

  const handleSubmit = async () => {
    setServerError("");
    setSubmitting(true);
    
    try {
      const response = await api.simulateTxn(
        currentUser.user_id,
        parseFloat(form.amount),
        form.receiver_name,
        form.account_number,
      );

      // Instantly deduct from the UI balance for that real-time feel if approved
      if (response.status === "APPROVED" || response.is_flagged === false) {
        setAccountBalance(prev => prev - parseFloat(form.amount));
      }
      
      // Clear form and errors
      setForm({ receiver_name: "", account_number: "", amount: "" });
      setErrors({ receiver_name: "", account_number: "", amount: "" });
      await fetchHistory();
    } catch (e) {
      setServerError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const flaggedCount = transactions.filter((t) => t.is_flagged).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-white text-2xl font-bold tracking-tight">AML Simulator</h2>
          <p className="text-slate-400 text-sm mt-1">Simulate transactions and observe AML scoring in real-time</p>
        </div>

        {/* Live Balance Widget */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-4 shadow-lg min-w-[200px]">
          <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
            <Wallet size={20} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center gap-4">
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Available Balance</p>
              <p className="text-[9px] font-mono text-slate-500">A/C: {myAccountNumber}</p>
            </div>
            <p className="text-lg font-mono font-bold text-white leading-tight">
              ₹{accountBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* KYC Conditional Form Rendering */}
      {currentUser?.kyc_status === "VERIFIED" ? (
        <Panel>
          <SectionHeader title="New Transaction" />
          <div className="grid grid-cols-3 gap-6">
            {FORM_FIELDS.map(({ key, label, placeholder, icon: Icon, type }) => (
              <div key={key} className="relative">
                <label className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-2 block">
                  {label}
                </label>
                <div className="relative">
                  <Icon size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${errors[key] ? "text-rose-500" : "text-slate-500"}`} />
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    className={`w-full bg-slate-900 border rounded-xl pl-9 pr-4 py-3 text-white text-sm focus:outline-none focus:ring-2 transition-all font-mono ${
                      errors[key] 
                        ? "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20" 
                        : "border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/10"
                    }`}
                  />
                </div>
                {/* GPay style inline error message */}
                {errors[key] && (
                  <div className="absolute -bottom-5 left-0 flex items-center gap-1 text-rose-400 mt-1">
                    <AlertCircle size={10} />
                    <span className="text-[10px] font-mono">{errors[key]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {serverError && (
            <div className="mt-8 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-lg text-xs font-mono">
              {serverError}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!isFormValid || submitting}
            className="mt-8 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-white rounded-xl text-sm font-mono transition-all flex items-center gap-2 group"
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Processing...</>
              : <><Zap size={14} className={`${isFormValid ? "group-hover:animate-bounce" : ""}`} /> Pay Securely</>
            }
          </button>
        </Panel>
      ) : (
        <Panel>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-slate-800 p-4 rounded-full mb-4">
              <Lock size={32} className="text-slate-500" />
            </div>
            <h3 className="text-white text-lg font-bold mb-2">Account Restricted</h3>
            <p className="text-slate-400 text-sm max-w-md">
              Transactions are currently locked. You must complete your biometric KYC verification and receive Analyst approval before sending funds.
            </p>
          </div>
        </Panel>
      )}

      {/* History table */}
      <Panel>
        <SectionHeader
          title="Transaction History"
          subtitle={`${flaggedCount} flagged of ${transactions.length} total`}
          actions={
            <button
              onClick={fetchHistory}
              className="text-xs font-mono text-slate-400 bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-slate-600 transition-all"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          }
        />

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="text-emerald-400 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-slate-500 text-sm font-mono text-center py-8">
            No transactions yet — submit one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  {/* Updated Header: Receiver -> Party */}
                  {["Txn ID", "Party", "Account", "Amount", "AML Score", "Status", "Time"].map((h) => (
                    <th key={h} className="text-left text-xs font-mono uppercase tracking-wider text-slate-500 pb-3 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {transactions.map((t) => (
                  <tr
                    key={t.transaction_id}
                    className={t.is_flagged ? "bg-rose-500/5" : ""}
                  >
                    <td className="py-3 pr-4 text-slate-400 text-xs font-mono">
                      #{t.transaction_id}
                    </td>
                    <td className="py-3 pr-4 text-white text-sm font-medium truncate max-w-[120px]">
                      {/* Smart Party Display: Shows Sender if incoming, Receiver if outgoing */}
                      {t.account_number === myAccountNumber ? t.sender_name : t.receiver_name}
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-xs font-mono">
                      {t.account_number}
                    </td>
                    <td className="py-3 pr-4 text-white text-sm font-mono flex items-center gap-1">
                       {/* Color code the amount based on incoming/outgoing */}
                       <span className={t.account_number === myAccountNumber ? "text-emerald-400" : "text-white"}>
                        {t.account_number === myAccountNumber ? "+" : "-"}
                        ₹{typeof formatINR === "function"
                            ? formatINR(t.amount)
                            : t.amount.toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-1.5 w-16">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              t.anomaly_score > 0.7 ? "bg-rose-500"
                              : t.anomaly_score > 0.4 ? "bg-amber-500"
                              : "bg-emerald-500"
                            }`}
                            style={{ width: `${t.anomaly_score * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono font-bold ${
                          t.anomaly_score > 0.7 ? "text-rose-400"
                          : t.anomaly_score > 0.4 ? "text-amber-400"
                          : "text-emerald-400"
                        }`}>
                          {t.anomaly_score.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge status={t.is_flagged ? "flagged" : "safe"} />
                    </td>
                    <td className="py-3 text-slate-500 text-xs font-mono">
                        {t.created_at && new Date(t.created_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit", 
                            minute: "2-digit",
                            hour12: true
                        })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}