import Link from "next/link";
import type { Metadata } from "next";
import CopyButton from "./CopyButton";

export const metadata: Metadata = {
  title: "API description (GET) | e-GP",
  description: "รายการ API endpoint ที่รองรับเฉพาะเมธอด GET",
};

type ApiEndpoint = {
  path: string;
  description: string;
  queryParams?: string[];
  exampleRequest: string;
  exampleResponse: string;
};

const getEndpoints: ApiEndpoint[] = [
  {
    path: "/api/egp/agencies",
    description: "ดึงรายการหน่วยงานพร้อม id เพื่อนำไปใช้เป็น agencyId",
    exampleRequest: "/api/egp/agencies",
    exampleResponse: `{
  "items": [
    {
      "id": "cmnsittl20000yhh0e9bzagmd",
      "name": "สำนักงานตัวอย่าง",
      "deptId": "00001",
      "deptsubId": "00001001",
      "status": 1,
      "createdAt": "2026-04-24T00:00:00.000Z",
      "updatedAt": "2026-04-24T00:00:00.000Z"
    }
  ]
}`,
  },
  {
    path: "/api/egp/projects?agencyId={agencyId}",
    description: "ดึงโครงการโดยกรองด้วย agencyId",
    queryParams: ["agencyId"],
    exampleRequest: "/api/egp/projects?agencyId=cmnsittl20000yhh0e9bzagmd",
    exampleResponse: `{
  "items": [
    {
      "id": "cmnproj7k0001yhh0xj4w1111",
      "projectNumber": "67-1234",
      "title": "จัดซื้อเวชภัณฑ์ตัวอย่าง",
      "methodId": "15",
      "status": "ประกาศผลผู้ชนะ",
      "centralPriceBaht": "2500000",
      "winnerName": "บริษัท ตัวอย่าง จำกัด",
      "winnerAmountBaht": "2395000",
      "bidDate": "2026-04-20T00:00:00.000Z",
      "updatedAt": "2026-04-24T03:20:00.000Z",
      "agencyId": "cmnsittl20000yhh0e9bzagmd",
      "agencyName": "สำนักงานตัวอย่าง",
      "agencyDeptId": "00001",
      "agencyDeptsubId": "00001001",
      "announcements": [
        {
          "id": "cmnann8m0001yhh0h0x22222",
          "announceType": "15",
          "rawDescription": "ประกาศผู้ชนะการเสนอราคา",
          "link": "https://example.egp.go.th/announcement/1",
          "publishedAt": "2026-04-18T02:10:00.000Z"
        }
      ]
    }
  ],
  "total": 1
}`,
  },
  {
    path: "/api/egp/announcements/project/{projectNumber}",
    description:
      "ดึงรายละเอียดโครงการจาก projectNumber (หรือ id) พร้อมประกาศทั้งหมดของโครงการ",
    queryParams: ["agencyId (optional)"],
    exampleRequest:
      "/api/egp/announcements/project/67-1234?agencyId=cmnsittl20000yhh0e9bzagmd",
    exampleResponse: `{
  "id": "cmnproj7k0001yhh0xj4w1111",
  "projectNumber": "67-1234",
  "title": "จัดซื้อเวชภัณฑ์ตัวอย่าง",
  "methodId": "15",
  "centralPriceBaht": "2500000",
  "winnerName": "บริษัท ตัวอย่าง จำกัด",
  "winnerAmountBaht": "2395000",
  "bidDate": "2026-04-20T00:00:00.000Z",
  "status": "ประกาศผลผู้ชนะ",
  "agency": {
    "id": "cmnsittl20000yhh0e9bzagmd",
    "name": "สำนักงานตัวอย่าง",
    "deptId": "00001",
    "deptsubId": "00001001"
  },
  "types": [
    {
      "id": "cmnann8m0001yhh0h0x22222",
      "announceType": "15",
      "rawDescription": "ประกาศผู้ชนะการเสนอราคา",
      "link": "https://example.egp.go.th/announcement/1",
      "publishedAt": "2026-04-18T02:10:00.000Z"
    }
  ]
}`,
  },
];

export default function ApiDescriptionPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900 md:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold sm:text-3xl">
            API description
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            API Endpoint description for GET requests only
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              กลับหน้าแรก
            </Link>
          </div>
        </header>

        <section className="grid gap-4">
          {getEndpoints.map((endpoint) => (
            <article
              key={endpoint.path}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  GET
                </span>
                <code className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-800">
                  {endpoint.path}
                </code>
              </div>
              <p className="text-sm text-slate-700">{endpoint.description}</p>
              {endpoint.queryParams?.length ? (
                <p className="mt-3 text-xs text-slate-500">
                  Query params: {endpoint.queryParams.join(", ")}
                </p>
              ) : null}
              <p className="mt-3 text-xs font-medium text-slate-700">
                Example request
              </p>
              <div className="mt-1 flex items-start gap-2">
                <code className="inline-block rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">
                  {endpoint.exampleRequest}
                </code>
                <CopyButton value={endpoint.exampleRequest} />
              </div>
              <p className="mt-3 text-xs font-medium text-slate-700">
                Example response
              </p>
              <div className="mt-1">
                <div className="mb-2">
                  <CopyButton value={endpoint.exampleResponse} />
                </div>
                <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                  {endpoint.exampleResponse}
                </pre>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
