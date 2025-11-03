import { ZodTypeAny } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: { message: 'Validation failed', details: result.error.format() } });
    }
    // replace body with parsed value
    req.body = result.data;
    return next();
  };
}
