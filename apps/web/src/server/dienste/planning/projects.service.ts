import { prisma } from '@/server/prisma';
import { numbers } from '../common/numbering/number-range.service';
import { ConflictException, NotFoundException } from '@/server/nest-ersatz';
import { round, type Paginated } from '@garagentor/shared';
import { type Prisma, ProjectStatus, TaskStatus } from '@prisma/client';
import { paginate } from '@/server/anfrage';

import type {
  CreateProjectDto,
  CreateProjectTaskDto,
  ProjectQueryDto,
  UpdateProjectDto,
  UpdateProjectTaskDto,
} from './dto/planning.dto';

export class ProjectsService {
  async findAll(query: ProjectQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.ProjectWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.managerId ? { managerId: query.managerId } : {}),
      ...(query.search
        ? {
            OR: [
              { projectNumber: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        include: {
          customer: { select: { id: true, companyName: true, firstName: true, lastName: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { orders: true, tasks: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      prisma.project.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        customer: true,
        site: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            subject: true,
            status: true,
            netTotal: true,
            grossTotal: true,
          },
        },
        tasks: {
          orderBy: [{ position: 'asc' }, { dueDate: 'asc' }],
          include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Das Projekt wurde nicht gefunden.');
    }

    const done = project.tasks.filter((task) => task.status === TaskStatus.ERLEDIGT).length;
    return {
      ...project,
      fortschritt: project.tasks.length > 0 ? Math.round((done / project.tasks.length) * 100) : 0,
    };
  }

  /** Gegenüberstellung von Budget, Auftragswert und erfassten Stunden. */
  async summary(id: string) {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException('Das Projekt wurde nicht gefunden.');
    }

    const [orders, hours, invoiced] = await prisma.$transaction([
      prisma.order.aggregate({
        where: { projectId: id, status: { not: 'STORNIERT' } },
        _sum: { netTotal: true },
        _count: true,
      }),
      prisma.timeEntry.aggregate({
        where: { projectId: id },
        _sum: { hours: true },
      }),
      prisma.invoice.aggregate({
        where: { order: { projectId: id }, status: { not: 'STORNIERT' } },
        _sum: { netTotal: true },
      }),
    ]);

    const budget = project.budget?.toNumber() ?? null;
    const auftragswert = round(orders._sum.netTotal?.toNumber() ?? 0);

    return {
      budget,
      auftragswert,
      auftraege: orders._count,
      abgerechnetNetto: round(invoiced._sum.netTotal?.toNumber() ?? 0),
      stunden: round(hours._sum.hours?.toNumber() ?? 0),
      budgetAusgeschoepft: budget && budget > 0 ? round((auftragswert / budget) * 100, 1) : null,
    };
  }

  async create(dto: CreateProjectDto) {
    return prisma.$transaction(async (tx) => {
      const projectNumber = await numbers.next('PROJECT', tx);
      return tx.project.create({
        data: {
          projectNumber,
          name: dto.name,
          customerId: dto.customerId ?? null,
          siteId: dto.siteId ?? null,
          managerId: dto.managerId ?? null,
          description: dto.description ?? null,
          budget: dto.budget ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        },
        include: { customer: true, manager: true },
      });
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException('Das Projekt wurde nicht gefunden.');
    }

    return prisma.project.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.customerId === undefined ? {} : { customerId: dto.customerId }),
        ...(dto.siteId === undefined ? {} : { siteId: dto.siteId }),
        ...(dto.managerId === undefined ? {} : { managerId: dto.managerId }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        ...(dto.budget === undefined ? {} : { budget: dto.budget }),
        ...(dto.startDate === undefined
          ? {}
          : { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate === undefined
          ? {}
          : { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.status === undefined
          ? {}
          : {
              status: dto.status,
              completedAt: dto.status === ProjectStatus.ABGESCHLOSSEN ? new Date() : null,
            }),
      },
      include: { customer: true, manager: true },
    });
  }

  async remove(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!project) {
      throw new NotFoundException('Das Projekt wurde nicht gefunden.');
    }
    if (project._count.orders > 0) {
      throw new ConflictException(
        'Dem Projekt sind Aufträge zugeordnet. Es kann nur abgebrochen werden.',
      );
    }

    await prisma.project.delete({ where: { id } });
    return { deleted: true, id };
  }

  /* Aufgaben ----------------------------------------------------------- */

  async addTask(projectId: string, dto: CreateProjectTaskDto) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Das Projekt wurde nicht gefunden.');
    }

    // Ohne Vorgabe wird die Aufgabe ans Ende gestellt.
    const position = dto.position ?? (await prisma.projectTask.count({ where: { projectId } }));

    return prisma.projectTask.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description ?? null,
        assigneeId: dto.assigneeId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        milestone: dto.milestone ?? false,
        position,
      },
      include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async updateTask(projectId: string, taskId: string, dto: UpdateProjectTaskDto) {
    const task = await prisma.projectTask.findFirst({ where: { id: taskId, projectId } });
    if (!task) {
      throw new NotFoundException('Die Aufgabe wurde nicht gefunden.');
    }

    return prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        ...(dto.assigneeId === undefined ? {} : { assigneeId: dto.assigneeId }),
        ...(dto.dueDate === undefined
          ? {}
          : { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.milestone === undefined ? {} : { milestone: dto.milestone }),
        ...(dto.position === undefined ? {} : { position: dto.position }),
        ...(dto.status === undefined
          ? {}
          : {
              status: dto.status,
              completedAt: dto.status === TaskStatus.ERLEDIGT ? new Date() : null,
            }),
      },
      include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async removeTask(projectId: string, taskId: string) {
    const result = await prisma.projectTask.deleteMany({ where: { id: taskId, projectId } });
    if (result.count === 0) {
      throw new NotFoundException('Die Aufgabe wurde nicht gefunden.');
    }
    return { deleted: true, id: taskId };
  }
}

export const projectsService = new ProjectsService();
