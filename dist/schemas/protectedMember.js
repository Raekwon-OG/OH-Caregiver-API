"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtectedMemberUpdateSchema = exports.ProtectedMemberCreateSchema = void 0;
const zod_1 = require("zod");
exports.ProtectedMemberCreateSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().optional(),
    relationship: zod_1.z.string().min(1),
    birthYear: zod_1.z.number().int().min(1900).max(new Date().getFullYear()).optional(),
    status: zod_1.z.enum(['active', 'inactive']).optional().default('active'),
});
exports.ProtectedMemberUpdateSchema = exports.ProtectedMemberCreateSchema.partial();
