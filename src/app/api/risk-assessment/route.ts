import { NextRequest, NextResponse } from "next/server";
import { signedFetch } from "@/lib/patientOnboarding";
import { buildFhirRiskAssessment, parseRiskAssessment, RiskType } from "@/lib/fhirRiskAssessment";

const region = "us-east-1";
const datastoreId = process.env.AWS_HEALTHLAKE_DATASTORE_ID;

function base() {
  return `https://healthlake.${region}.amazonaws.com/datastore/${datastoreId}/r4`;
}

export async function POST(req: NextRequest) {
  try {
    if (!datastoreId) {
      return NextResponse.json({ error: "AWS_HEALTHLAKE_DATASTORE_ID not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { patientId, visitId, type, score, category, methodText, rawInputs } = body;

    const doctorId = req.headers.get("x-verified-doctor-id") || body.doctorId || "doc-current";
    const doctorName = req.headers.get("x-verified-doctor-name") || body.doctorName || "Attending Physician";

    if (!patientId || !visitId || !type) {
      return NextResponse.json({ error: "patientId, visitId and type are required" }, { status: 400 });
    }
    if (type !== "syntax" && type !== "lipid") {
      return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
    }
    if (typeof score !== "number" || !isFinite(score)) {
      return NextResponse.json({ error: "score must be a number" }, { status: 400 });
    }

    const resource = buildFhirRiskAssessment({
      patientId,
      visitId,
      doctorId,
      doctorName,
      type: type as RiskType,
      score,
      category: category || "",
      methodText: methodText || "",
      rawInputs: rawInputs ?? {},
    });

    const res = await signedFetch(`${base()}/RiskAssessment/${resource.id}`, "PUT", JSON.stringify(resource));
    if (!res.ok) {
      const errText = await res.text();
      console.error("[HealthLake] RiskAssessment write failed:", errText);
      throw new Error(`Could not save the risk assessment: ${errText}`);
    }

    return NextResponse.json({ success: true, data: parseRiskAssessment(resource) });
  } catch (error: any) {
    console.error("[POST /api/risk-assessment] error:", error);
    return NextResponse.json({ error: "Failed to save risk assessment", details: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!datastoreId) {
      return NextResponse.json({ error: "AWS_HEALTHLAKE_DATASTORE_ID not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const type = searchParams.get("type");
    const visitId = searchParams.get("visitId");

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const res = await signedFetch(`${base()}/RiskAssessment?subject=Patient/${encodeURIComponent(patientId)}&_count=50`, "GET");
    if (!res.ok) {
      const errText = await res.text();
      console.error("[HealthLake] RiskAssessment fetch failed:", errText);
      throw new Error(`HealthLake query failed: ${errText}`);
    }
    const bundle = await res.json();
    let list = (bundle.entry || []).map((e: any) => parseRiskAssessment(e.resource));

    if (type) list = list.filter((r: any) => r.type === type);
    if (visitId) list = list.filter((r: any) => r.visitId === visitId);

    list.sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    console.error("[GET /api/risk-assessment] error:", error);
    return NextResponse.json({ error: "Failed to fetch risk assessments", details: error.message }, { status: 500 });
  }
}
