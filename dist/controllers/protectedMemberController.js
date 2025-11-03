"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMember = createMember;
exports.listMembers = listMembers;
exports.getMember = getMember;
exports.updateMember = updateMember;
exports.deleteMember = deleteMember;
const service = __importStar(require("../services/protectedMemberService"));
async function createMember(req, res) {
    const caregiverId = req.user.id;
    const payload = req.body;
    const created = await service.createMember(caregiverId, payload);
    res.status(201).json(created);
}
async function listMembers(req, res) {
    const caregiverId = req.user.id;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const result = await service.listMembers(caregiverId, page, limit);
    res.json(result);
}
async function getMember(req, res) {
    const caregiverId = req.user.id;
    const id = req.params.id;
    const item = await service.getMember(caregiverId, id);
    if (!item)
        return res.status(404).json({ error: { message: 'Not found' } });
    res.json(item);
}
async function updateMember(req, res) {
    const caregiverId = req.user.id;
    const id = req.params.id;
    const updated = await service.updateMember(caregiverId, id, req.body);
    if (!updated)
        return res.status(404).json({ error: { message: 'Not found' } });
    res.json(updated);
}
async function deleteMember(req, res) {
    const caregiverId = req.user.id;
    const id = req.params.id;
    await service.deleteMember(caregiverId, id);
    res.status(204).send();
}
