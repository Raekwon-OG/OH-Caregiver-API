import { Request, Response } from 'express';
import * as service from '../services/protectedMemberService';

export async function createMember(req: Request, res: Response) {
  const caregiverId = (req as any).user.id as string;
  const payload = req.body;
  const created = await service.createMember(caregiverId, payload);
  res.status(201).json(created);
}

export async function listMembers(req: Request, res: Response) {
  const caregiverId = (req as any).user.id as string;
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const result = await service.listMembers(caregiverId, page, limit);
  res.json(result);
}

export async function getMember(req: Request, res: Response) {
  const caregiverId = (req as any).user.id as string;
  const id = req.params.id;
  const item = await service.getMember(caregiverId, id);
  if (!item) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(item);
}

export async function updateMember(req: Request, res: Response) {
  const caregiverId = (req as any).user.id as string;
  const id = req.params.id;
  const updated = await service.updateMember(caregiverId, id, req.body);
  if (!updated) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(updated);
}

export async function deleteMember(req: Request, res: Response) {
  const caregiverId = (req as any).user.id as string;
  const id = req.params.id;
  await service.deleteMember(caregiverId, id);
  res.status(204).send();
}
