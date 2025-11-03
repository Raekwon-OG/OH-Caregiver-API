"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaregiverLoginSchema = exports.CaregiverSignupSchema = void 0;
const zod_1 = require("zod");
exports.CaregiverSignupSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
exports.CaregiverLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
