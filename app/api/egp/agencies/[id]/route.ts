import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import {
  mergedAgencyHasRssScope,
  validateAgencyPatchBody,
} from "@/lib/egpAgencyValidation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const agency = await prisma.egpAgency.findUnique({
    where: { id },
  });

  if (!agency) {
    return NextResponse.json({ error: "ไม่พบหน่วยงาน" }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      id: agency.id,
      name: agency.name,
      deptId: agency.deptId,
      deptsubId: agency.deptsubId,
      status: agency.status,
      createdAt: agency.createdAt.toISOString(),
      updatedAt: agency.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const existing = await prisma.egpAgency.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "ไม่พบหน่วยงาน" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "ไม่สามารถอ่าน JSON ได้" },
      { status: 400 },
    );
  }

  const validated = validateAgencyPatchBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const patch = validated.data;

  if (
    patch.deptId !== undefined ||
    patch.deptsubId !== undefined
  ) {
    if (
      !mergedAgencyHasRssScope(
        { deptId: existing.deptId, deptsubId: existing.deptsubId },
        patch,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "หลังอัปเดตต้องมี deptId หรือ deptsubId อย่างน้อยหนึ่งค่า",
        },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await prisma.egpAgency.update({
      where: { id },
      data: patch,
    });

    return NextResponse.json({
      item: {
        id: updated.id,
        name: updated.name,
        deptId: updated.deptId,
        deptsubId: updated.deptsubId,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "พบข้อมูลซ้ำกับข้อจำกัด unique ในระบบ" },
          { status: 409 },
        );
      }
    }
    throw e;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const existing = await prisma.egpAgency.findUnique({
    where: { id },
    include: {
      _count: { select: { projects: true, announcements: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "ไม่พบหน่วยงาน" }, { status: 404 });
  }

  if (
    existing._count.projects > 0 ||
    existing._count.announcements > 0
  ) {
    return NextResponse.json(
      {
        error:
          "ไม่สามารถลบได้: ยังมีโครงการหรือประกาศอ้างอิงหน่วยงานนี้",
      },
      { status: 409 },
    );
  }

  try {
    await prisma.egpAgency.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2003") {
        return NextResponse.json(
          {
            error:
              "ไม่สามารถลบได้: ยังมีข้อมูลอ้างอิงหน่วยงานนี้",
          },
          { status: 409 },
        );
      }
    }
    throw e;
  }
}
