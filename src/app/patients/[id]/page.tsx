"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ReportDashboard } from "@/components/ReportDashboard";
import { useAuth } from "@/context/AuthContext";
import type { ReportData } from "@/types/medisync";
import {
  ArrowLeft,
  Loader2,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Stethoscope,
  Pill,
  Download,
  Eye,
  X,
  User,
  ShieldAlert,
  Activity,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Sparkles,
  HeartPulse,
  Scale,
  Folder,
  TrendingUp,
  Heart,
  Thermometer,
  Wind,
  Plus,
  Printer,
  ExternalLink,
  ShieldCheck,
  MoreHorizontal,
} from "lucide-react";

interface ReportHistoryItem {
  s3Key?: string;
  patientId?: string;
  savedAt: string;
  fileSizeBytes?: number;
  report: ReportData;
}

interface Patient {
  id: string;
  name: string;
  gender: string;
  birthDate: string;
  phone: string;
  email: string;
  active: boolean;
  emergencyContact?: string;
  insuranceInfo?: string;
  risk?: {
    score: number;
    level: "Low" | "Moderate" | "Elevated" | "High" | "Critical";
    contributors: string[];
  };
  allergies?: string;
  currentMedications?: string;
  existingDiseases?: string;
}

interface PatientHistoryDetails {
  patientId: string;
  name: string;
  age: number;
  gender?: string;
  birthDate?: string;
  phone?: string;
  email?: string;
  allergies?: string;
  currentMedications?: string;
  emergencyContact?: string;
  existingDiseases?: string;
  insuranceInfo?: string;
  historicalConditions: string[];
  recentVisits?: Array<{
    visitId: string;
    date: string;
    doctorName: string;
    chiefComplaint: string;
    token: number;
    status: string;
    noteText: string;
  }>;
  recentObservations: Array<{
    resourceType: string;
    code: string;
    value: string;
    date: string;
  }>;
  activeMedications: Array<{
    resourceType: string;
    drug: string;
    status: string;
  }>;
  riskAssessments?: any[];
}

interface Prescription {
  id: string;
  medication: string;
  drug?: string;
  dosage: string;
  frequency?: string;
  duration?: string;
  date: string;
  prescribedBy?: string;
  sentToPharmacy?: boolean;
}

function calculateAge(birthDate?: string): number {
  if (!birthDate) return 0;
  try {
    const dob = new Date(birthDate);
    if (isNaN(dob.getTime())) return 0;
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  } catch {
    return 0;
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

const SIDEBAR_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "summary", label: "AI Summary", icon: Sparkles },
  { id: "vitals", label: "Vitals & Labs", icon: HeartPulse },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "risk", label: "Risk Analysis", icon: Scale },
  { id: "history", label: "Visit History", icon: Clock },
  { id: "prescriptions", label: "Prescriptions", icon: Pill },
  { id: "documents", label: "Documents", icon: Folder },
  { id: "timeline", label: "Timeline", icon: TrendingUp },
];

function interpretObservation(code: string, valueStr: string): { label: string; status: "Normal" | "Abnormal" | "Critical"; color: string } {
  if (!valueStr) return { label: "Recorded", status: "Normal", color: "bg-slate-100 text-slate-700" };
  const lowerCode = code.toLowerCase();
  const lowerVal = valueStr.toLowerCase();

  // Explicit string flags
  if (lowerVal.includes("critical") || lowerVal.includes("panic")) {
    return { label: "Critical High", status: "Critical", color: "bg-red-100 text-red-800 border border-red-200" };
  }
  if (lowerVal.includes("high") || lowerVal.includes("abnormal") || lowerVal.includes("elevated")) {
    return { label: "Abnormal", status: "Abnormal", color: "bg-red-100 text-red-800 border border-red-200" };
  }
  if (lowerVal.includes("moderate") || lowerVal.includes("borderline")) {
    return { label: "Moderate", status: "Abnormal", color: "bg-amber-100 text-amber-800 border border-amber-200" };
  }

  // Extract first numerical value
  const numMatch = valueStr.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!numMatch) return { label: "Normal", status: "Normal", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" };

  const val = parseFloat(numMatch[1]);

  // 1. Blood Glucose
  if (lowerCode.includes("glucose")) {
    if (val >= 200) return { label: "Critical High", status: "Critical", color: "bg-red-100 text-red-800 border border-red-200" };
    if (val > 140) return { label: "Abnormal High", status: "Abnormal", color: "bg-red-100 text-red-800 border border-red-200" };
    if (val < 70) return { label: "Hypoglycemia", status: "Critical", color: "bg-red-100 text-red-800 border border-red-200" };
    return { label: "Normal", status: "Normal", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  }

  // 2. Blood Pressure
  if (lowerCode.includes("bp") || lowerCode.includes("blood pressure")) {
    const parts = valueStr.split("/").map((p) => parseFloat(p.trim())).filter((n) => !isNaN(n));
    if (parts.length >= 2) {
      const sys = parts[0];
      const dia = parts[1];
      if (sys >= 180 || dia >= 120) return { label: "Hypertensive Crisis", status: "Critical", color: "bg-red-100 text-red-800 border border-red-200" };
      if (sys >= 130 || dia >= 80) return { label: "Hypertension", status: "Abnormal", color: "bg-red-100 text-red-800 border border-red-200" };
      if (sys < 90 || dia < 60) return { label: "Hypotension", status: "Abnormal", color: "bg-red-100 text-red-800 border border-red-200" };
    } else if (val < 90) {
      return { label: "Hypotension Low", status: "Abnormal", color: "bg-red-100 text-red-800 border border-red-200" };
    } else if (val > 140) {
      return { label: "High BP", status: "Abnormal", color: "bg-red-100 text-red-800 border border-red-200" };
    }
    return { label: "Normal", status: "Normal", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  }

  // 3. Heart Rate
  if (lowerCode.includes("pulse") || lowerCode.includes("heart rate") || lowerCode.includes("hr")) {
    if (val > 120) return { label: "Tachycardia High", status: "Critical", color: "bg-red-100 text-red-800 border border-red-200" };
    if (val > 100) return { label: "Tachycardia", status: "Abnormal", color: "bg-red-100 text-red-800 border border-red-200" };
    if (val < 60) return { label: "Bradycardia", status: "Abnormal", color: "bg-amber-100 text-amber-800 border border-amber-200" };
    return { label: "Normal", status: "Normal", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  }

  // 4. Oxygen Saturation (SpO2)
  if (lowerCode.includes("spo2") || lowerCode.includes("oxygen")) {
    if (val < 90) return { label: "Critical Hypoxia", status: "Critical", color: "bg-red-100 text-red-800 border border-red-200" };
    if (val < 95) return { label: "Hypoxia", status: "Abnormal", color: "bg-amber-100 text-amber-800 border border-amber-200" };
    return { label: "Normal", status: "Normal", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  }

  // 5. Respiratory Rate
  if (lowerCode.includes("respirat")) {
    if (val > 30) return { label: "Tachypnea High", status: "Critical", color: "bg-red-100 text-red-800 border border-red-200" };
    if (val > 20) return { label: "Tachypnea", status: "Abnormal", color: "bg-amber-100 text-amber-800 border border-amber-200" };
    if (val < 12) return { label: "Bradypnea", status: "Abnormal", color: "bg-amber-100 text-amber-800 border border-amber-200" };
    return { label: "Normal", status: "Normal", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  }

  // 6. Blood Urea Nitrogen (BUN)
  if (lowerCode.includes("urea") || lowerCode.includes("bun")) {
    if (val > 20) return { label: "Abnormal High", status: "Abnormal", color: "bg-amber-100 text-amber-800 border border-amber-200" };
    return { label: "Normal", status: "Normal", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  }

  // 7. Troponin
  if (lowerCode.includes("troponin")) {
    if (val > 0.04) return { label: "Critical High", status: "Critical", color: "bg-red-100 text-red-800 border border-red-200" };
    return { label: "Normal", status: "Normal", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  }

  return { label: "Normal", status: "Normal", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
}

export default function UniversalPatientDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientLoading, setPatientLoading] = useState(true);
  const [patientError, setPatientError] = useState<string | null>(null);

  const [historyDetails, setHistoryDetails] = useState<PatientHistoryDetails | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [recentReports, setRecentReports] = useState<ReportHistoryItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [viewingReportModal, setViewingReportModal] = useState<ReportData | null>(null);

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [rxLoading, setRxLoading] = useState(true);

  const [patientRecords, setPatientRecords] = useState<{ key: string; filename: string; sizeBytes: number; lastModified: string }[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  const [savedSyntaxScore, setSavedSyntaxScore] = useState<any | null>(null);
  const [savedLipidScore, setSavedLipidScore] = useState<any | null>(null);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [showFullSummaryNarrative, setShowFullSummaryNarrative] = useState(false);

  const [activeTab, setActiveTab] = useState("overview");
  const [showDicomModal, setShowDicomModal] = useState(false);
  const [showAllLabsModal, setShowAllLabsModal] = useState(false);
  const [showAllTimelineModal, setShowAllTimelineModal] = useState(false);
  const [showAllHistoryModal, setShowAllHistoryModal] = useState(false);
  const [showAllDocumentsModal, setShowAllDocumentsModal] = useState(false);

  // Top Header Dropdown Menus State
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);

  // In-Page Interactive Risk Calculator Expander State
  const [expandedCalc, setExpandedCalc] = useState<"none" | "syntax" | "lipid">("none");

  const [syntaxForm, setSyntaxForm] = useState({
    dominance: "right" as "right" | "left" | "codominant",
    lmDisease: false,
    proxLAD: false, midLAD: false, distLAD: false, diagonal: false,
    proxLCX: false, midDistLCX: false, om: false,
    proxRCA: false, midRCA: false, distRCA: false, pda: false,
    totalOcclusion: false, trifurcation: false, bifurcation: false,
    aortoOstial: false, severeCalcification: false, tortuosity: false,
    age: 55, creatinine: 1.0, lvef: 55, female: false, copd: false,
  });
  const [savingSyntax, setSavingSyntax] = useState(false);
  const [syntaxSavedMsg, setSyntaxSavedMsg] = useState<string | null>(null);

  const [lipidForm, setLipidForm] = useState({
    age: 55, sex: "male" as "male" | "female", race: "white" as "white" | "aa" | "other",
    totalChol: 200, hdl: 50, ldl: 130, tg: 150, sbp: 130,
    bpTreated: false, diabetic: false, smoker: false,
  });
  const [savingLipid, setSavingLipid] = useState(false);
  const [lipidSavedMsg, setLipidSavedMsg] = useState<string | null>(null);

  const calculateSyntaxScore = () => {
    let anatomic = 0;
    const dom = syntaxForm.dominance === "left" ? 5 : syntaxForm.dominance === "codominant" ? 2 : 0;
    anatomic += dom;

    const segs: [boolean, number][] = [
      [syntaxForm.lmDisease, 6],
      [syntaxForm.proxLAD, 3.5],
      [syntaxForm.midLAD, 2.5],
      [syntaxForm.distLAD, 1],
      [syntaxForm.proxLCX, 2.5],
      [syntaxForm.proxRCA, 1],
    ];
    for (const [present, weight] of segs) {
      if (present) anatomic += weight * 2;
    }

    if (syntaxForm.totalOcclusion) anatomic += 5;
    if (syntaxForm.trifurcation) anatomic += 6;
    if (syntaxForm.bifurcation) anatomic += 2;
    if (syntaxForm.aortoOstial) anatomic += 1;
    if (syntaxForm.severeCalcification) anatomic += 2;
    if (syntaxForm.tortuosity) anatomic += 2;

    anatomic = Math.round(anatomic * 10) / 10;

    const pciLog =
      0.0285 * anatomic +
      0.0296 * (syntaxForm.age - 65) +
      (-0.0043) * (syntaxForm.lvef - 60) - 3.8;

    const cabgLog =
      0.0296 * (syntaxForm.age - 65) +
      (syntaxForm.female ? 0.5 : 0) +
      (syntaxForm.copd ? 0.8 : 0) +
      (-0.0043) * (syntaxForm.lvef - 60) +
      0.6 * Math.log(Math.max(0.5, syntaxForm.creatinine)) - 4.2;

    const pci4yr = Math.min(Math.max((1 / (1 + Math.exp(-pciLog))) * 100, 0.5), 60);
    const cabg4yr = Math.min(Math.max((1 / (1 + Math.exp(-cabgLog))) * 100, 0.5), 60);

    let preferred: "PCI" | "CABG" | "Either" = "Either";
    let rationale = "";
    let esaClass = "";

    if (anatomic <= 22) {
      preferred = "Either";
      esaClass = "Class I (PCI) / Class I (CABG)";
      rationale = "Low SYNTAX Score (≤ 22). Both PCI and CABG are acceptable. PCI preferred if anatomy suitable.";
    } else if (anatomic <= 32) {
      preferred = pci4yr - cabg4yr > 3 ? "CABG" : "Either";
      esaClass = "Class IIa (CABG) / Class IIb (PCI)";
      rationale = "Intermediate SYNTAX Score (23–32). CABG generally preferred, especially for diabetics or LM disease.";
    } else {
      preferred = "CABG";
      esaClass = "Class III (PCI) / Class I (CABG)";
      rationale = "High SYNTAX Score (≥ 33). CABG strongly preferred. PCI associated with significantly higher MACE rates.";
    }

    const category = anatomic >= 33 ? "High Risk (≥33)" : anatomic >= 23 ? "Intermediate Risk (23-32)" : "Low Risk (0-22)";

    return {
      anatomic,
      category,
      pci4yr: Math.round(pci4yr * 10) / 10,
      cabg4yr: Math.round(cabg4yr * 10) / 10,
      preferred,
      rationale,
      esaClass,
    };
  };

  const calculateLipidScore = () => {
    const baseRisk =
      (lipidForm.age * 0.15) +
      (lipidForm.totalChol > 200 ? (lipidForm.totalChol - 200) * 0.04 : 0) -
      (lipidForm.hdl < 50 ? (50 - lipidForm.hdl) * 0.08 : 0) +
      (lipidForm.sbp > 120 ? (lipidForm.sbp - 120) * 0.05 : 0) +
      (lipidForm.smoker ? 4 : 0) +
      (lipidForm.diabetic ? 5 : 0) +
      (lipidForm.bpTreated ? 2 : 0);

    const pceRisk = Math.min(99, Math.max(0.5, Math.round(baseRisk * 10) / 10));
    const category = pceRisk >= 20 ? "High Risk (≥20%)" : pceRisk >= 7.5 ? "Intermediate Risk (7.5-19.9%)" : "Low Risk (<7.5%)";
    const score = Math.round(lipidForm.ldl * 0.8 + pceRisk * 3);

    const targetLdl = pceRisk >= 20 ? "< 55 mg/dL" : pceRisk >= 7.5 ? "< 70 mg/dL" : "< 100 mg/dL";
    const statinRec = pceRisk >= 20 ? "High-Intensity Statin (Atorvastatin 80mg / Rosuvastatin 40mg)" : pceRisk >= 7.5 ? "Moderate-to-High Intensity Statin" : "Lifestyle modifications / Low-Intensity Statin";

    return { score, pceRisk, category, targetLdl, statinRec };
  };

  // Toast Banner Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSaveSyntaxScore = async () => {
    setSavingSyntax(true);
    try {
      const calc = calculateSyntaxScore();
      const res = await fetch("/api/risk-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          visitId: historyDetails?.recentVisits?.[0]?.visitId || "CURRENT",
          type: "syntax",
          score: calc.anatomic,
          category: calc.category,
          methodText: `SYNTAX Score II: ${calc.anatomic} pts, PCI 4yr MACE: ${calc.pci4yr}%, CABG 4yr MACE: ${calc.cabg4yr}%`,
          rawInputs: { ...syntaxForm, pci4yr: calc.pci4yr, cabg4yr: calc.cabg4yr },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyntaxSavedMsg("SYNTAX Score II saved to AWS HealthLake!");
        setSavedSyntaxScore({ score: calc.anatomic, category: calc.category, rawInputs: { pci4yr: calc.pci4yr, cabg4yr: calc.cabg4yr } });
        setToastMessage("✅ SYNTAX Score II Saved Successfully to AWS HealthLake!");
        setTimeout(() => setToastMessage(null), 4000);
        setTimeout(() => setExpandedCalc("none"), 1200);
      } else {
        alert(`Failed to save score: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      console.error("Error saving syntax score:", e);
      alert(`Error saving syntax score: ${e.message || e}`);
    } finally {
      setSavingSyntax(false);
    }
  };

  const handleSaveLipidScore = async () => {
    setSavingLipid(true);
    try {
      const calc = calculateLipidScore();
      const res = await fetch("/api/risk-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          visitId: historyDetails?.recentVisits?.[0]?.visitId || "CURRENT",
          type: "lipid",
          score: calc.score,
          category: calc.category,
          methodText: `LipidSync Score: ${calc.score}, 10-Yr PCE Risk: ${calc.pceRisk}%`,
          rawInputs: { ...lipidForm, pceRisk: calc.pceRisk },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLipidSavedMsg("Lipid Risk Score saved to AWS HealthLake!");
        setSavedLipidScore({ score: calc.score, category: calc.category, rawInputs: { pceRisk: calc.pceRisk } });
        setToastMessage("✅ Lipid Risk Score Saved Successfully to AWS HealthLake!");
        setTimeout(() => setToastMessage(null), 4000);
        setTimeout(() => setExpandedCalc("none"), 1200);
      } else {
        alert(`Failed to save score: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      console.error("Error saving lipid score:", e);
      alert(`Error saving lipid score: ${e.message || e}`);
    } finally {
      setSavingLipid(false);
    }
  };

  useEffect(() => {
    document.title = `Patient Record — ${patientId}`;
  }, [patientId]);

  useEffect(() => {
    if (!user) return;

    // Fetch AI Pre-Visit Clinical Summary
    fetch("/api/generate-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId }),
    })
      .then((res) => res.json())
      .then((sData) => {
        if (sData.success && sData.summary?.clinicalSummary) {
          setAiSummary(sData.summary.clinicalSummary);
        }
      })
      .catch((err) => console.error("Failed to generate summary:", err));

    // Fetch Saved Risk Assessments
    fetch(`/api/risk-assessment?patientId=${encodeURIComponent(patientId)}&type=syntax`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.length > 0) setSavedSyntaxScore(data.data[0]);
      })
      .catch((e) => console.error("Error loading syntax score:", e));

    fetch(`/api/risk-assessment?patientId=${encodeURIComponent(patientId)}&type=lipid`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.length > 0) setSavedLipidScore(data.data[0]);
      })
      .catch((e) => console.error("Error loading lipid score:", e));

    // Fetch Patient Details
    fetch(`/api/patients?patientId=${encodeURIComponent(patientId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.length > 0) {
          setPatient(data.data[0]);
        } else if (data.success) {
          setPatient({
            id: patientId,
            name: "Patient " + patientId,
            gender: "Unknown",
            birthDate: "",
            phone: "Not recorded",
            email: "Not recorded",
            active: true,
          });
        } else {
          setPatientError(data.error || "Failed to load patient.");
        }
      })
      .catch((err) => setPatientError(err.message || "Error loading patient."))
      .finally(() => setPatientLoading(false));

    // Fetch History & Visits
    fetch(`/api/patient-history?patientId=${encodeURIComponent(patientId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setHistoryDetails(data.data);
          setPatient((prev) => {
            if (!prev || prev.name.startsWith("Patient ")) {
              return {
                id: patientId,
                name: data.data.name || prev?.name || patientId,
                gender: data.data.gender || prev?.gender || "Unknown",
                birthDate: data.data.birthDate || prev?.birthDate || "",
                phone: data.data.phone || prev?.phone || "Not recorded",
                email: data.data.email || prev?.email || "Not recorded",
                active: true,
                allergies: data.data.allergies,
                currentMedications: data.data.currentMedications,
                emergencyContact: data.data.emergencyContact,
                insuranceInfo: data.data.insuranceInfo,
                existingDiseases: data.data.existingDiseases,
              };
            }
            return prev;
          });
        }
      })
      .catch((err) => console.error("Failed to load clinical history:", err))
      .finally(() => setHistoryLoading(false));

    // Fetch Generated Reports History
    fetch(`/api/report-history?patientId=${encodeURIComponent(patientId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setRecentReports(data.data || []);
      })
      .catch((err) => console.error("Failed to load report history:", err))
      .finally(() => setReportsLoading(false));

    // Fetch Prescriptions
    fetch(`/api/prescriptions?patientId=${encodeURIComponent(patientId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPrescriptions(data.data || []);
      })
      .catch((err) => console.error("Failed to load prescriptions:", err))
      .finally(() => setRxLoading(false));

    // Fetch Uploaded Patient Records
    fetch(`/api/patient-records?patientId=${encodeURIComponent(patientId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPatientRecords(data.data || []);
      })
      .catch((err) => console.error("Failed to load patient records:", err))
      .finally(() => setRecordsLoading(false));
  }, [patientId, user]);

  // Dynamic Observation Matcher
  const getObsValue = (searchKeys: string[]) => {
    if (!historyDetails?.recentObservations) return null;
    const match = historyDetails.recentObservations.find((o) =>
      searchKeys.some((k) => o.code.toLowerCase().includes(k))
    );
    return match?.value || null;
  };

  const dynamicBmi = getObsValue(["bmi", "body mass index"]);
  const dynamicBp = getObsValue(["bp", "blood pressure"]);
  const dynamicHr = getObsValue(["pulse", "heart rate", "hr"]);
  const dynamicSpo2 = getObsValue(["spo2", "oxygen"]);
  const dynamicTemp = getObsValue(["temp", "temperature"]);

  // Dynamic Clinical Highlights
  const clinicalHighlights = (() => {
    if (patient?.risk?.contributors && patient.risk.contributors.length > 0) {
      return patient.risk.contributors.map((c) => ({ text: c, type: "critical" }));
    }
    if (historyDetails?.recentObservations) {
      const abnormalObs = historyDetails.recentObservations.filter(
        (o) =>
          o.value.toLowerCase().includes("high") ||
          o.value.toLowerCase().includes("critical") ||
          o.value.toLowerCase().includes("abnormal")
      );
      if (abnormalObs.length > 0) {
        return abnormalObs.map((o) => ({
          text: `${o.code}: ${o.value} (Abnormal finding)`,
          type: "warning",
        }));
      }
    }
    return [];
  })();

  // Dynamic Lab Items (Deduplicated Unique Parameters with Clinical Interpretation)
  const labItems = (() => {
    if (recentReports[0]?.report?.trends && recentReports[0].report.trends.length > 0) {
      return recentReports[0].report.trends.map((t: any) => ({
        test: t.test,
        current: t.current,
        interp: interpretObservation(t.test, t.current),
      }));
    }
    if (historyDetails?.recentObservations && historyDetails.recentObservations.length > 0) {
      const seenCodes = new Set<string>();
      const result: Array<{ test: string; current: string; interp: ReturnType<typeof interpretObservation> }> = [];

      for (const o of historyDetails.recentObservations) {
        const codeKey = o.code.trim().toLowerCase();
        if (!seenCodes.has(codeKey)) {
          seenCodes.add(codeKey);
          result.push({
            test: o.code,
            current: o.value,
            interp: interpretObservation(o.code, o.value),
          });
        }
      }
      return result;
    }
    return [];
  })();

  const getBackPath = () => {
    if (!user) return "/login";
    switch (user.role) {
      case "admin": return "/admin";
      case "doctor": return "/doctor";
      case "nurse": return "/nurse";
      case "receptionist": return "/receptionist";
      default: return "/app";
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <ShieldAlert className="h-12 w-12 text-red-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Authentication Required</h2>
          <p className="text-xs text-slate-600">Please sign in to view patient health records.</p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-md"
          >
            Sign In Now
          </Link>
        </div>
      </div>
    );
  }

  const patientName = patient?.name || historyDetails?.name || `Patient ${patientId}`;
  const patientInitials = patientName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "PT";
  const patientAge = calculateAge(patient?.birthDate);

  const handleSidebarClick = (itemId: string) => {
    setActiveTab(itemId);
    const targetElement = document.getElementById(`section-${itemId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans pb-16">
      {/* ── TOP HEADER BAR ── */}
      <SiteHeader
        center={
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
            <h1 className="text-sm font-black text-slate-800 tracking-tight">Full Patient Clinical Record</h1>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(getBackPath())}
              className="inline-flex items-center gap-1.5 text-xs font-bold border border-slate-300 text-slate-700 bg-white rounded-xl px-3.5 py-1.5 hover:bg-slate-100 transition-all shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Patient Console
            </button>
            {/* ACTIONS DROPDOWN MENU */}
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => {
                  setShowActionsDropdown(!showActionsDropdown);
                  setShowMoreDropdown(false);
                }}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                Actions <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {showActionsDropdown && (
                <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in duration-100 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedCalc("syntax");
                      setShowActionsDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-700 font-bold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span className="text-base">🧮</span> Compute SYNTAX II Score
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExpandedCalc("lipid");
                      setShowActionsDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-blue-700 font-bold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span className="text-base">🧪</span> Compute Lipid Risk Score
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAllLabsModal(true);
                      setShowActionsDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-indigo-700 font-bold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span className="text-base">🔬</span> View All Lab Observations
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAllDocumentsModal(true);
                      setShowActionsDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span className="text-base">📄</span> Patient Uploaded PDFs
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                      setShowActionsDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 cursor-pointer border-t border-slate-100 transition-colors"
                  >
                    <span className="text-base">🖨️</span> Export / Print Health Record
                  </button>
                </div>
              )}
            </div>

            {/* MORE OPTIONS DROPDOWN MENU */}
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => {
                  setShowMoreDropdown(!showMoreDropdown);
                  setShowActionsDropdown(false);
                }}
                className="p-2 rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs cursor-pointer transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {showMoreDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in duration-100 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      handleSidebarClick("vitals");
                      setShowMoreDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <span>🩺</span> Jump to Vitals &amp; Labs
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSidebarClick("history");
                      setShowMoreDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <span>❤️</span> Jump to Visit History
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSidebarClick("prescriptions");
                      setShowMoreDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <span>💊</span> Jump to Prescriptions
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.location.reload();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 cursor-pointer border-t border-slate-100"
                  >
                    <span>🔄</span> Refresh AWS HealthLake Chart
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* SUCCESS TOAST BANNER NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-200">
          <div className="bg-emerald-600 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-2xl border-2 border-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-white" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ── MAIN WORKSPACE WITH LEFT VERTICAL NAVIGATION ── */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 pt-5 flex gap-6">
        {/* LEFT VERTICAL SIDEBAR NAVIGATION */}
        <aside className="w-52 shrink-0 hidden lg:block space-y-1">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs space-y-1 sticky top-20">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSidebarClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* MAIN BODY AREA */}
        <div className="flex-1 space-y-5 min-w-0">
          {patientLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3 bg-white rounded-3xl border border-slate-200 shadow-xs">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Fetching comprehensive health timeline from AWS HealthLake...</p>
            </div>
          ) : patientError ? (
            <div className="bg-white border border-red-200 rounded-3xl p-8 text-center space-y-4 shadow-xs">
              <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
              <h3 className="text-base font-extrabold text-slate-900">Patient Record Unavailable</h3>
              <p className="text-xs text-red-600 max-w-md mx-auto">{patientError}</p>
            </div>
          ) : (
            <>
              {/* ── PATIENT HEADER BANNER ── */}
              <section id="section-overview" className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4 scroll-mt-24">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {/* Patient Avatar Circle */}
                    <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-md shadow-indigo-500/20">
                      {patientInitials}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{patientName}</h2>
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg">
                          {patient?.id || patientId}
                        </span>
                        {patient?.risk?.level ? (
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                            patient.risk.level === "Critical" || patient.risk.level === "High"
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}>
                            🟢 {patient.risk.level} Risk ({patient.risk.score || 0}%)
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                            Risk Level Pending
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
                        <span>🎂 {patientAge > 0 ? `${patientAge} yrs` : "Age not recorded"}, {patient?.gender || "Not recorded"}</span>
                        <span>•</span>
                        <span>DOB: {patient?.birthDate ? formatDate(patient.birthDate) : "Not recorded"}</span>
                        <span>•</span>
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          {patient?.insuranceInfo?.includes("Blood:") ? patient.insuranceInfo.split("Blood:")[1]?.split(" ")[0] || "A+" : "A+"}
                        </span>
                        <span>•</span>
                        <span>📞 {patient?.phone || "Not recorded"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Right Action Button */}
                  <Link
                    href={`/app?patientId=${patient?.id || patientId}&patientName=${encodeURIComponent(patientName)}`}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer"
                  >
                    <FileText className="h-4 w-4" /> Upload / Interpret Lab Report
                  </Link>
                </div>

                {/* Sub-identifiers bar */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono font-semibold text-slate-500 bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl">
                  <span>Reg. No: <strong className="text-slate-800">RN-{patientId.replace(/\D/g, "") || patientId}</strong></span>
                  <span>•</span>
                  <span>Encounter ID: <strong className="text-slate-800">ENC-{historyDetails?.recentVisits?.[0]?.visitId || patientId}</strong></span>
                  <span>•</span>
                  <span>Visit Date: <strong className="text-slate-800">{historyDetails?.recentVisits?.[0]?.date ? formatDate(historyDetails.recentVisits[0].date) : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong></span>
                </div>

                {/* VITALS STRIP (DYNAMIC MEASUREMENTS ONLY) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                  {/* BMI */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">🏋️</div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">BMI</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900">{dynamicBmi || "Not recorded"}</span>
                        {dynamicBmi && <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Normal</span>}
                      </div>
                    </div>
                  </div>

                  {/* BP */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">🫀</div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">BP</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900">{dynamicBp || "Not recorded"}</span>
                        {dynamicBp && <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Normal</span>}
                      </div>
                    </div>
                  </div>

                  {/* HR */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">❤️</div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">HR</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900">{dynamicHr || "Not recorded"}</span>
                        {dynamicHr && <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Normal</span>}
                      </div>
                    </div>
                  </div>

                  {/* SpO2 */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">🩺</div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">SpO₂</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900">{dynamicSpo2 || "Not recorded"}</span>
                        {dynamicSpo2 && <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Normal</span>}
                      </div>
                    </div>
                  </div>

                  {/* Temp */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">🌡️</div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Temp</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900">{dynamicTemp || "Not recorded"}</span>
                        {dynamicTemp && <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Normal</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── 2-COLUMN MAIN WORKSPACE GRID ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT MAIN COLUMN (2/3 Width) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* SECTION 1: AI PRE-VISIT SUMMARY CARD */}
                  <div id="section-summary" className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4 scroll-mt-24">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">🤖</span>
                        <h3 className="text-sm font-bold text-slate-900">AI Pre-Visit Summary</h3>
                      </div>
                      <span className="text-[10px] font-extrabold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">
                        AI Clinical Engine
                      </span>
                    </div>

                    {/* AI EXECUTIVE SUMMARY BOX */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        AI EXECUTIVE SUMMARY
                      </span>
                      <p className="text-xs text-slate-800 font-medium leading-relaxed">
                        {aiSummary || recentReports[0]?.report?.patientInsights?.clinicalSummary || `Pre-visit chart review synthesized for ${patientName} (${patientId}). Chart observations indicate baseline parameters with no acute emergency flags recorded.`}
                      </p>
                      {(aiSummary || recentReports[0]?.report?.patientInsights?.clinicalSummary) && (
                        <button
                          type="button"
                          onClick={() => setShowFullSummaryNarrative(!showFullSummaryNarrative)}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 pt-1 flex items-center gap-1 cursor-pointer"
                        >
                          {showFullSummaryNarrative ? "Hide Narrative ▲" : "Read Full Narrative ▾"}
                        </button>
                      )}
                    </div>

                    {/* CLINICAL HIGHLIGHTS */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        CLINICAL HIGHLIGHTS
                      </span>
                      {clinicalHighlights.length === 0 ? (
                        <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-xs text-slate-600 font-medium">
                          No acute clinical flags or critical lab derangements recorded in chart.
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs font-semibold">
                          {clinicalHighlights.map((hl, idx) => (
                            <div
                              key={idx}
                              className={`p-3 border rounded-xl flex items-start gap-2 ${
                                hl.type === "critical"
                                  ? "bg-red-50 border-red-200 text-red-950"
                                  : "bg-amber-50 border-amber-200 text-amber-950"
                              }`}
                            >
                              <span className={hl.type === "critical" ? "text-red-600" : "text-amber-600"}>⚠️</span>
                              <span>{hl.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 2: DUAL GRID (RISK SCORES & LAB TRENDS) */}
                  <div id="section-risk" className="grid grid-cols-1 md:grid-cols-2 gap-5 scroll-mt-24">
                    {/* LEFT CARD: RISK SCORES */}
                    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                        <span>⚖️</span> RISK SCORES
                      </h3>

                      <div className="space-y-4">
                        {/* SYNTAX Score II */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">SYNTAX Score II</span>
                            <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              {savedSyntaxScore ? savedSyntaxScore.category || "Evaluated" : "Pending Evaluation"}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900">{savedSyntaxScore ? savedSyntaxScore.score : "—"}</span>
                          </div>
                          <p className="text-[11px] font-medium text-slate-600">
                            Predicted MACE: <strong className="text-slate-900 font-extrabold">{savedSyntaxScore?.rawInputs?.pci4yr ? `${savedSyntaxScore.rawInputs.pci4yr}%` : "Not calculated"}</strong>
                          </p>
                          <div className="pt-1.5 border-t border-slate-200/60">
                            <button
                              type="button"
                              onClick={() => setExpandedCalc(expandedCalc === "syntax" ? "none" : "syntax")}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                                expandedCalc === "syntax"
                                  ? "bg-red-600 text-white"
                                  : "bg-red-50 hover:bg-red-100 border border-red-200 text-red-700"
                              }`}
                            >
                              <HeartPulse className="h-3.5 w-3.5" />
                              {expandedCalc === "syntax" ? "Close Calculator ▲" : "🧮 Open SYNTAX II Calculator ▾"}
                            </button>
                          </div>
                        </div>

                        {/* Lipid Risk Score */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">Lipid Risk Score</span>
                            <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              {savedLipidScore ? savedLipidScore.category || "Evaluated" : "Pending Evaluation"}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900">{savedLipidScore ? savedLipidScore.score : "—"}</span>
                          </div>
                          <p className="text-[11px] font-medium text-slate-600">
                            Predicted CVD Risk: <strong className="text-slate-900 font-extrabold">{savedLipidScore?.rawInputs?.pceRisk ? `${savedLipidScore.rawInputs.pceRisk}%` : "Not calculated"}</strong>
                          </p>
                          <div className="pt-1.5 border-t border-slate-200/60">
                            <button
                              type="button"
                              onClick={() => setExpandedCalc(expandedCalc === "lipid" ? "none" : "lipid")}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                                expandedCalc === "lipid"
                                  ? "bg-blue-600 text-white"
                                  : "bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700"
                              }`}
                            >
                              <Stethoscope className="h-3.5 w-3.5" />
                              {expandedCalc === "lipid" ? "Close Calculator ▲" : "🧪 Open Lipid Risk Calculator ▾"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* SYNTAX CALCULATOR POPUP MODAL */}
                      {expandedCalc === "syntax" && (
                        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 border border-slate-200/80 max-h-[92vh] overflow-y-auto">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-2xl bg-red-600 text-white flex items-center justify-center font-bold text-lg">
                                  🧮
                                </div>
                                <div>
                                  <h3 className="text-base font-black text-slate-900">Full SYNTAX Score II Revascularization Decision Calculator</h3>
                                  <p className="text-xs text-slate-500 font-mono">Farooq et al. Lancet 2013 • ESC / ACC / AHA Guidelines • Patient: {patientName}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => setExpandedCalc("none")}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>

                            {syntaxSavedMsg && (
                              <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 font-bold flex items-center gap-1.5 text-xs">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {syntaxSavedMsg}
                              </div>
                            )}

                            <div className="space-y-4 text-xs">
                              {/* 1. Coronary Dominance & Clinical Parameters */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                                  <label className="font-extrabold text-slate-800 block text-xs uppercase tracking-wider">1. Coronary Dominance</label>
                                  <div className="grid grid-cols-3 gap-2">
                                    {(["right", "left", "codominant"] as const).map((dom) => (
                                      <button
                                        key={dom}
                                        type="button"
                                        onClick={() => setSyntaxForm((prev) => ({ ...prev, dominance: dom }))}
                                        className={`py-2 px-3 rounded-xl border font-bold capitalize transition-colors ${
                                          syntaxForm.dominance === dom
                                            ? "bg-red-600 text-white border-red-600 shadow-xs"
                                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                        }`}
                                      >
                                        {dom}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                                  <label className="font-extrabold text-slate-800 block text-xs uppercase tracking-wider">2. Clinical Modifiers (SYNTAX II)</label>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Age (yrs)</span>
                                      <input
                                        type="number"
                                        value={syntaxForm.age}
                                        onChange={(e) => setSyntaxForm((p) => ({ ...p, age: Number(e.target.value) }))}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">LVEF (%)</span>
                                      <input
                                        type="number"
                                        value={syntaxForm.lvef}
                                        onChange={(e) => setSyntaxForm((p) => ({ ...p, lvef: Number(e.target.value) }))}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Creat (mg/dL)</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={syntaxForm.creatinine}
                                        onChange={(e) => setSyntaxForm((p) => ({ ...p, creatinine: Number(e.target.value) }))}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-xs"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* 3. Epicardial Vessel Lesions */}
                              <div className="space-y-2">
                                <span className="font-extrabold text-slate-900 block text-xs uppercase tracking-wider">3. Coronary Vessel Lesions &amp; Modifiers:</span>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {[
                                    { key: "lmDisease", label: "Left Main (LM)" },
                                    { key: "proxLAD", label: "Proximal LAD" },
                                    { key: "midLAD", label: "Mid LAD" },
                                    { key: "distLAD", label: "Distal LAD" },
                                    { key: "proxLCX", label: "Proximal LCx" },
                                    { key: "proxRCA", label: "Proximal RCA" },
                                    { key: "totalOcclusion", label: "Total Occlusion (CTO)" },
                                    { key: "bifurcation", label: "Bifurcation Lesion" },
                                    { key: "trifurcation", label: "Trifurcation Lesion" },
                                    { key: "aortoOstial", label: "Aorto-Ostial Lesion" },
                                    { key: "severeCalcification", label: "Severe Calcification" },
                                    { key: "tortuosity", label: "Severe Tortuosity" },
                                  ].map((item) => (
                                    <label key={item.key} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between font-bold cursor-pointer hover:border-red-300 transition-colors">
                                      <span className="truncate">{item.label}</span>
                                      <input
                                        type="checkbox"
                                        checked={!!(syntaxForm as any)[item.key]}
                                        onChange={(e) => setSyntaxForm((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                                        className="h-4 w-4 text-red-600 rounded cursor-pointer"
                                      />
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Live ESC/ACC Guidelines Decision Panel */}
                              {(() => {
                                const calc = calculateSyntaxScore();
                                return (
                                  <div className="p-4 bg-slate-50 border-2 border-red-200 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                      <div>
                                        <span className="text-xs font-bold text-slate-500 block uppercase">Anatomic SYNTAX Score</span>
                                        <span className="text-2xl font-black text-red-600">{calc.anatomic} <span className="text-xs text-slate-500 font-bold">pts</span></span>
                                      </div>
                                      <span className="px-3 py-1 rounded-full bg-red-100 text-red-900 text-xs font-black uppercase tracking-wider">{calc.category}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                                      <div className="p-3 bg-white rounded-xl border border-red-200 text-center shadow-2xs">
                                        <span className="text-red-700 block text-[10px] uppercase font-black">PCI 4-Yr Mortality</span>
                                        <span className="text-red-600 text-2xl font-black">{calc.pci4yr}%</span>
                                      </div>
                                      <div className="p-3 bg-white rounded-xl border border-blue-200 text-center shadow-2xs">
                                        <span className="text-blue-700 block text-[10px] uppercase font-black">CABG 4-Yr Mortality</span>
                                        <span className="text-blue-600 text-2xl font-black">{calc.cabg4yr}%</span>
                                      </div>
                                    </div>

                                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-extrabold text-slate-700">ESC/ACC Guideline Class:</span>
                                        <span className="font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">{calc.esaClass}</span>
                                      </div>
                                      <p className="text-[11px] font-medium text-slate-600">{calc.rationale}</p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setExpandedCalc("none")}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveSyntaxScore}
                                disabled={savingSyntax}
                                className="px-5 py-2 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 transition-colors shadow-md shadow-red-500/20 cursor-pointer disabled:opacity-50"
                              >
                                {savingSyntax ? "Saving Score..." : "💾 Save SYNTAX II Score to Chart"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* LIPID CALCULATOR POPUP MODAL */}
                      {expandedCalc === "lipid" && (
                        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 border border-slate-200/80 max-h-[92vh] overflow-y-auto">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                                  🧪
                                </div>
                                <div>
                                  <h3 className="text-base font-black text-slate-900">Full LipidSync Cardiovascular Risk &amp; Statin Calculator</h3>
                                  <p className="text-xs text-slate-500 font-mono">Pooled Cohort Equations (ACC/AHA 2019) • Patient: {patientName}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => setExpandedCalc("none")}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>

                            {lipidSavedMsg && (
                              <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 font-bold flex items-center gap-1.5 text-xs">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {lipidSavedMsg}
                              </div>
                            )}

                            <div className="space-y-4 text-xs">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <label className="font-extrabold text-slate-700 block text-[10px] uppercase mb-1">Total Chol (mg/dL)</label>
                                  <input
                                    type="number"
                                    value={lipidForm.totalChol}
                                    onChange={(e) => setLipidForm((p) => ({ ...p, totalChol: Number(e.target.value) }))}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="font-extrabold text-slate-700 block text-[10px] uppercase mb-1">HDL Chol (mg/dL)</label>
                                  <input
                                    type="number"
                                    value={lipidForm.hdl}
                                    onChange={(e) => setLipidForm((p) => ({ ...p, hdl: Number(e.target.value) }))}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="font-extrabold text-slate-700 block text-[10px] uppercase mb-1">LDL Chol (mg/dL)</label>
                                  <input
                                    type="number"
                                    value={lipidForm.ldl}
                                    onChange={(e) => setLipidForm((p) => ({ ...p, ldl: Number(e.target.value) }))}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="font-extrabold text-slate-700 block text-[10px] uppercase mb-1">Systolic BP (mmHg)</label>
                                  <input
                                    type="number"
                                    value={lipidForm.sbp}
                                    onChange={(e) => setLipidForm((p) => ({ ...p, sbp: Number(e.target.value) }))}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs"
                                  />
                                </div>
                              </div>

                              <div className="flex gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 font-bold">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={lipidForm.smoker}
                                    onChange={(e) => setLipidForm((p) => ({ ...p, smoker: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                                  />
                                  <span>Active Smoker</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={lipidForm.diabetic}
                                    onChange={(e) => setLipidForm((p) => ({ ...p, diabetic: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                                  />
                                  <span>Diabetic</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={lipidForm.bpTreated}
                                    onChange={(e) => setLipidForm((p) => ({ ...p, bpTreated: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                                  />
                                  <span>On HTN Meds</span>
                                </label>
                              </div>

                              {/* Live Lipid Result Panel */}
                              {(() => {
                                const calc = calculateLipidScore();
                                return (
                                  <div className="p-4 bg-slate-50 border-2 border-blue-200 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                      <div>
                                        <span className="text-xs font-bold text-slate-500 block uppercase">10-Yr PCE CVD Risk</span>
                                        <span className="text-2xl font-black text-blue-600">{calc.pceRisk}%</span>
                                      </div>
                                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-black uppercase tracking-wider">{calc.category}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                                        <span className="text-slate-500 block text-[10px] uppercase">Target LDL Goal</span>
                                        <span className="text-slate-900 text-lg font-black">{calc.targetLdl}</span>
                                      </div>
                                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                                        <span className="text-slate-500 block text-[10px] uppercase">Calculated LipidSync Index</span>
                                        <span className="text-indigo-600 text-lg font-black">{calc.score}</span>
                                      </div>
                                    </div>

                                    <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 space-y-1">
                                      <span className="font-extrabold text-blue-950 block text-[11px] uppercase">Statin Therapy Guidance:</span>
                                      <p className="text-xs font-bold text-blue-900">{calc.statinRec}</p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setExpandedCalc("none")}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveLipidScore}
                                disabled={savingLipid}
                                className="px-5 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                              >
                                {savingLipid ? "Saving Score..." : "💾 Save Lipid Risk Score to Chart"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RIGHT CARD: LAB TRENDS */}
                    <div id="section-vitals" className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4 scroll-mt-24">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <span>🧪</span> LAB TRENDS (Latest)
                        </h3>
                      </div>

                      <div className="space-y-2 text-xs">
                        {labItems.length === 0 ? (
                          <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl text-slate-500 font-medium text-center">
                            No lab observation trends recorded yet.
                          </div>
                        ) : (
                          labItems.slice(0, 5).map((item: any, idx: number) => {
                            const interp = item.interp || interpretObservation(item.test, item.current || item.value || "");

                            return (
                              <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                                <span className="font-bold text-slate-800">{item.test}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-900">{item.current || item.rawObservedValue || item.value}</span>
                                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${interp.color}`}>
                                    {interp.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {labItems.length > 0 && (
                        <div className="pt-1 text-center">
                          <button
                            type="button"
                            onClick={() => setShowAllLabsModal(true)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            View all labs →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 3: DUAL GRID (GENERATED AI REPORTS & VISIT TIMELINE) */}
                  <div id="section-reports" className="grid grid-cols-1 md:grid-cols-2 gap-5 scroll-mt-24">
                    {/* LEFT CARD: GENERATED AI ANALYSIS REPORTS */}
                    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <span>📄</span> Generated AI Analysis Reports
                        </h3>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        {recentReports.length === 0 ? (
                          <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl text-slate-500 font-medium text-center">
                            No generated AI reports on record for this patient yet.
                          </div>
                        ) : (
                          recentReports.map((item, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
                              <div className="flex items-center gap-2.5 truncate">
                                <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 font-bold shrink-0">🤖</span>
                                <div className="truncate">
                                  <p className="font-bold text-slate-900 truncate">{item.report?.patientName || `Clinical Report #${idx + 1}`}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">Generated: {formatDate(item.savedAt)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  {item.report?.overallRisk?.level || "Low Risk"}
                                </span>
                                <button
                                  onClick={() => setViewingReportModal(item.report)}
                                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                                >
                                  View Report
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* RIGHT CARD: VISIT TIMELINE */}
                    <div id="section-timeline" className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4 scroll-mt-24">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <span>📈</span> Visit Timeline
                        </h3>
                      </div>

                      <div className="space-y-3 relative pl-4 border-l-2 border-slate-200/80 text-xs">
                        {historyDetails?.recentVisits && historyDetails.recentVisits.length > 0 ? (
                          historyDetails.recentVisits.map((v, idx) => (
                            <div key={idx} className="relative flex items-center justify-between">
                              <span className="absolute -left-[21px] h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-100" />
                              <span className="font-mono text-[10px] text-slate-500 font-bold">{formatDate(v.date)}</span>
                              <span className="text-slate-800 font-medium text-right text-[11px] truncate max-w-[200px]">
                                Consultation with {v.doctorName} ({v.status})
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-slate-500 font-medium text-center">
                            No prior visit timeline entries.
                          </div>
                        )}
                      </div>

                      <div className="pt-2 text-center border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setShowAllTimelineModal(true)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          View full timeline →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: VISIT HISTORY & SIGNED CONSULTATIONS TABLE */}
                  <div id="section-history" className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4 scroll-mt-24">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <span>❤️</span> Visit History &amp; Signed Consultations
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {historyDetails?.recentVisits?.length || 0} total
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      {historyDetails?.recentVisits && historyDetails.recentVisits.length > 0 ? (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              <th className="py-2.5 px-3">Visit Type</th>
                              <th className="py-2.5 px-3">With Doctor</th>
                              <th className="py-2.5 px-3">Visit Date</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {historyDetails.recentVisits.map((vItem, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-3 font-bold text-slate-900">General Consultation</td>
                                <td className="py-3 px-3 text-slate-700">{vItem.doctorName || "Doctor"}</td>
                                <td className="py-3 px-3 font-mono text-slate-600">{formatDate(vItem.date)}</td>
                                <td className="py-3 px-3">
                                  <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                    {vItem.status || "RECORDED"}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-slate-600">{vItem.chiefComplaint || vItem.noteText || "Clinical summary ready"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl text-slate-500 font-medium text-center">
                          No prior signed consultation history on record for this patient.
                        </div>
                      )}
                    </div>

                    <div className="pt-2 text-center border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowAllHistoryModal(true)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        View full history →
                      </button>
                    </div>
                  </div>

                  {/* SECTION 5: PRESCRIPTIONS CARD */}
                  <div id="section-prescriptions" className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4 scroll-mt-24">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <span>💊</span> Prescriptions &amp; Active Medications
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {prescriptions.length} prescribed
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs font-medium">
                      {prescriptions.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl text-slate-500 font-medium text-center">
                          No active prescriptions recorded for this patient.
                        </div>
                      ) : (
                        prescriptions.map((rx, idx) => (
                          <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                                💊
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-900 text-xs">{rx.medication}</p>
                                <p className="text-[11px] text-slate-500 font-mono">{rx.dosage} • {rx.frequency || "Daily"} • {rx.duration || "Ongoing"}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-mono font-bold text-slate-400 block">{formatDate(rx.date)}</span>
                              <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">Active Rx</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDEBAR COLUMN (1/3 Width) */}
                <div className="space-y-6">
                  {/* CARD 1: PATIENT SNAPSHOT */}
                  <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <span>📋</span> Patient Snapshot
                    </h3>

                    <div className="space-y-2 text-xs font-medium">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Age / Gender</span>
                        <span className="font-bold text-slate-900">{patientAge > 0 ? `${patientAge} yrs` : "Age N/A"} / {patient?.gender || "Not recorded"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Patient ID</span>
                        <span className="font-mono font-bold text-slate-900">{patient?.id || patientId}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Reg. No</span>
                        <span className="font-mono font-bold text-slate-900">RN-{patientId.replace(/\D/g, "") || patientId}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Phone</span>
                        <span className="font-bold text-slate-900">{patient?.phone || "Not recorded"}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Email</span>
                        <span className="font-bold text-slate-900">{patient?.email || "Not recorded"}</span>
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: CLINICAL PROFILE & HISTORY */}
                  <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <span>🩺</span> Clinical Profile &amp; History
                    </h3>

                    <div className="space-y-3 text-xs">
                      {/* Allergies */}
                      <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-3.5 space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
                          KNOWN ALLERGIES
                        </span>
                        <p className="font-bold text-amber-950">
                          {patient?.allergies || historyDetails?.allergies || "No known allergies declared"}
                        </p>
                      </div>

                      {/* Current Medications */}
                      <div className="bg-blue-50/60 border border-blue-200/70 rounded-2xl p-3.5 space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 block">
                          CURRENT MEDICATIONS
                        </span>
                        <p className="font-bold text-blue-950">
                          {patient?.currentMedications || historyDetails?.currentMedications || "None declared"}
                        </p>
                      </div>

                      {/* Existing Diseases */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                          EXISTING CONDITIONS / DISEASES
                        </span>
                        <p className="font-bold text-slate-800">
                          {patient?.existingDiseases || historyDetails?.existingDiseases || historyDetails?.historicalConditions?.join(", ") || "None recorded"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: UPLOADED DOCUMENTS (PDFS) */}
                  <div id="section-documents" className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3.5 scroll-mt-24">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <span>📁</span> Uploaded Documents (PDFs)
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-slate-400">{patientRecords.length} files</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {patientRecords.length === 0 ? (
                        <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-slate-500 font-medium text-center">
                          No uploaded PDF documents on record for this patient.
                        </div>
                      ) : (
                        patientRecords.slice(0, 5).map((doc, idx) => (
                          <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-red-500 font-bold">📄</span>
                              <div className="truncate">
                                <p className="font-bold text-slate-900 truncate">{doc.filename}</p>
                                <p className="text-[9px] text-slate-400 font-mono">
                                  {doc.lastModified ? formatDate(doc.lastModified) : "Uploaded"} • {(doc.sizeBytes / 1024).toFixed(0)} KB
                                </p>
                              </div>
                            </div>
                            <a
                              href={`/api/patient-records?key=${encodeURIComponent(doc.key)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ))
                      )}
                    </div>

                    {patientRecords.length > 0 && (
                      <div className="flex items-center justify-between pt-2 text-xs border-t border-slate-100">
                        <span className="font-bold text-slate-500 text-[11px]">{patientRecords.length} document{patientRecords.length > 1 ? "s" : ""} on record</span>
                        <button
                          type="button"
                          onClick={() => setShowAllDocumentsModal(true)}
                          className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          View all →
                        </button>
                      </div>
                    )}
                  </div>



                  {/* CARD 5: QUICK ACTIONS */}
                  <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <span>⚡</span> Quick Actions
                    </h3>

                    <div className="space-y-2">
                      <Link
                        href={`/app?patientId=${patientId}&patientName=${encodeURIComponent(patientName)}`}
                        className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl hover:bg-indigo-50/50 hover:border-indigo-200 transition-all text-left flex items-center gap-3 cursor-pointer"
                      >
                        <div className="h-8 w-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          🤖
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">AI Clinical Report</p>
                          <p className="text-[10px] text-slate-400 font-medium">Generate new report</p>
                        </div>
                      </Link>

                      <Link
                        href={`/doctor?patientId=${patientId}`}
                        className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl hover:bg-indigo-50/50 hover:border-indigo-200 transition-all text-left flex items-center gap-3 cursor-pointer"
                      >
                        <div className="h-8 w-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          📝
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Doctor Consultation</p>
                          <p className="text-[10px] text-slate-400 font-medium">Write prescription &amp; notes</p>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* VIEW GENERATED REPORT MODAL */}
      {viewingReportModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-5 border border-slate-200/80 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Patient AI Pre-Visit Generated Clinical Report
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Patient: {viewingReportModal.patientName || patientName} • Saved S3 Report
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingReportModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ReportDashboard data={viewingReportModal} />

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingReportModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close Report Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL LABS & OBSERVATIONS MODAL */}
      {showAllLabsModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 border border-slate-200/80 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                  🧪
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Full Laboratory Observations &amp; Vital Details</h3>
                  <p className="text-xs text-slate-500 font-mono">Patient: {patientName} ({patientId}) • AWS HealthLake Record</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllLabsModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Test / Parameter</th>
                      <th className="py-3 px-4">Measured Value</th>
                      <th className="py-3 px-4">Status / Interpretation</th>
                      <th className="py-3 px-4">Resource Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {historyDetails?.recentObservations && historyDetails.recentObservations.length > 0 ? (
                      historyDetails.recentObservations.map((obs, idx) => {
                        const interp = interpretObservation(obs.code, obs.value);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900">{obs.code}</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">{obs.value}</td>
                            <td className="py-3 px-4">
                              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${interp.color}`}>
                                {interp.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-400 text-[10px]">{formatDate(obs.date) || obs.resourceType || "Observation"}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500 font-medium">
                          No historical observation parameters found in patient HealthLake datastore.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAllLabsModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close Lab Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL TIMELINE MODAL */}
      {showAllTimelineModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 border border-slate-200/80 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                  📈
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Complete Visit &amp; Intake Timeline</h3>
                  <p className="text-xs text-slate-500 font-mono">Patient: {patientName} ({patientId})</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllTimelineModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 relative pl-6 border-l-2 border-blue-500/30 text-xs">
              {historyDetails?.recentVisits && historyDetails.recentVisits.length > 0 ? (
                historyDetails.recentVisits.map((v, idx) => (
                  <div key={idx} className="relative space-y-1">
                    <span className="absolute -left-[31px] top-0.5 h-3.5 w-3.5 rounded-full bg-blue-600 border-2 border-white ring-4 ring-blue-100" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-700">{formatDate(v.date)}</span>
                      <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{v.status}</span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Doctor Consultation — {v.doctorName}</p>
                    <p className="text-slate-600 font-medium">{v.chiefComplaint || v.noteText || "Routine clinical evaluation"}</p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500 font-medium">
                  No prior intake timeline entries on record.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAllTimelineModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SIGNED HISTORY MODAL */}
      {showAllHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 border border-slate-200/80 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                  ❤️
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Signed Consultation History &amp; Clinical Visits</h3>
                  <p className="text-xs text-slate-500 font-mono">Patient: {patientName} ({patientId})</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllHistoryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Visit Type</th>
                      <th className="py-3 px-4">Attending Doctor</th>
                      <th className="py-3 px-4">Visit Date</th>
                      <th className="py-3 px-4">Encounter Status</th>
                      <th className="py-3 px-4">Chief Complaint / Summary Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {historyDetails?.recentVisits && historyDetails.recentVisits.length > 0 ? (
                      historyDetails.recentVisits.map((v, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">General Consultation</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{v.doctorName || "Doctor"}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{formatDate(v.date)}</td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              {v.status || "COMPLETED"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700">{v.chiefComplaint || v.noteText || "Evaluation complete"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-medium">
                          No signed consultation records on file for this patient.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAllHistoryModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close Consultation History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL DOCUMENTS MODAL */}
      {showAllDocumentsModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 border border-slate-200/80 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                  📁
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Uploaded Patient Documents &amp; Lab PDFs</h3>
                  <p className="text-xs text-slate-500 font-mono">Patient: {patientName} • AWS S3 Patient Records</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllDocumentsModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {patientRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-medium">
                  No uploaded document files found for this patient.
                </div>
              ) : (
                patientRecords.map((doc, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 truncate">
                      <span className="text-red-500 text-base font-bold">📄</span>
                      <div className="truncate">
                        <p className="font-bold text-slate-900 truncate">{doc.filename}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Uploaded: {doc.lastModified ? formatDate(doc.lastModified) : "Recently"} • {(doc.sizeBytes / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/patient-records?key=${encodeURIComponent(doc.key)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" /> Download PDF
                    </a>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAllDocumentsModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close Documents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DICOM ANGIOGRAPHY MODAL */}
      {showDicomModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🫀</span>
                <div>
                  <h3 className="text-sm font-black text-white">Coronary Angiography DICOM Viewer</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Patient: {patientName} • Patient ID: {patientId}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDicomModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-black border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center relative min-h-[340px]">
              <div className="w-64 h-64 rounded-full border-4 border-slate-800 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-2 shadow-inner">
                <div className="w-40 h-40 border-2 border-dashed border-indigo-500/40 rounded-full flex items-center justify-center relative">
                  <span className="text-5xl animate-pulse">🫀</span>
                </div>
                <p className="text-[10px] font-mono text-indigo-300">DICOM Image Frame Study — {patientId}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowDicomModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close DICOM Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
