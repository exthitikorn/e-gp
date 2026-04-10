import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { validateAgencyCreateBody } from "@/lib/egpAgencyValidation";

export async function GET() {
  const items = await prisma.egpAgency.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({
    items: items.map((a) => ({
      id: a.id,
      name: a.name,
      deptId: a.deptId,
      deptsubId: a.deptsubId,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "ไม่สามารถอ่าน JSON ได้" },
      { status: 400 },
    );
  }

  const validated = validateAgencyCreateBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { name, deptId, deptsubId, status } = validated.data;

  try {
    const created = await prisma.egpAgency.create({
      data: {
        name,
        deptId,
        deptsubId,
        status,
      },
    });

    return NextResponse.json(
      {
        item: {
          id: created.id,
          name: created.name,
          deptId: created.deptId,
          deptsubId: created.deptsubId,
          status: created.status,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "รหัส deptsubId นี้มีในระบบแล้ว (ต้องไม่ซ้ำ)" },
          { status: 409 },
        );
      }
    }
    throw e;
  }
}
