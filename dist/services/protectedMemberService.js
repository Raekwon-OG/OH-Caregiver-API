"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMember = createMember;
exports.listMembers = listMembers;
exports.getMember = getMember;
exports.updateMember = updateMember;
exports.deleteMember = deleteMember;
const ProtectedMember_1 = require("../models/ProtectedMember");
const socket_1 = require("../utils/socket");
const mongoose_1 = require("mongoose");
const logger_1 = require("../utils/logger");
async function createMember(caregiverId, data) {
    const created = await ProtectedMember_1.ProtectedMember.create({ ...data, caregiverId: new mongoose_1.Types.ObjectId(caregiverId) });
    const obj = created.toObject();
    (0, socket_1.emitToCaregiver)(caregiverId, 'member_added', obj);
    logger_1.logger.info('protected_member.created', { caregiverId, memberId: obj._id?.toString?.() ?? null, firstName: obj.firstName });
    return obj;
}
async function listMembers(caregiverId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const items = await ProtectedMember_1.ProtectedMember.find({ caregiverId }).skip(skip).limit(limit).lean();
    const total = await ProtectedMember_1.ProtectedMember.countDocuments({ caregiverId });
    return { items, total, page, limit };
}
async function getMember(caregiverId, id) {
    const item = await ProtectedMember_1.ProtectedMember.findOne({ _id: id, caregiverId }).lean();
    return item;
}
async function updateMember(caregiverId, id, updates) {
    // optimistic concurrency: load document, apply changes and save with retry on version mismatch
    const envRetries = Number(process.env.PROTECTED_MEMBER_UPDATE_RETRIES || '') || 5;
    const maxAttempts = Math.min(Math.max(envRetries, 1), 10); // clamp between 1 and 10
    const baseDelayMs = 50;
    const jitterMaxMs = 100; // random jitter up to 100ms
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const doc = await ProtectedMember_1.ProtectedMember.findOne({ _id: id, caregiverId });
        if (!doc)
            return null;
        // apply updates
        Object.assign(doc, updates);
        try {
            const saved = await doc.save();
            const out = saved.toObject ? saved.toObject() : saved;
            // emit only after successful save
            (0, socket_1.emitToCaregiver)(caregiverId, 'member_updated', out);
            logger_1.logger.info('protected_member.updated', { caregiverId, memberId: id, attempt });
            return out;
        }
        catch (err) {
            // Mongoose VersionError indicates concurrent modification; retry with jittered backoff
            const name = err?.name || '';
            if (name === 'VersionError' && attempt < maxAttempts) {
                const jitter = Math.floor(Math.random() * jitterMaxMs);
                const delay = baseDelayMs * attempt + jitter;
                logger_1.logger.warn('protected_member.update_version_conflict', { caregiverId, memberId: id, attempt, delay });
                // small backoff with jitter
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }
            logger_1.logger.error('protected_member.update_failed', { caregiverId, memberId: id, err: String(err) });
            throw err;
        }
    }
    // if we exhausted attempts
    logger_1.logger.error('protected_member.update_exhausted_retries', { caregiverId, memberId: id });
    throw new Error('Failed to update protected member due to concurrent modifications');
}
async function deleteMember(caregiverId, id) {
    const res = await ProtectedMember_1.ProtectedMember.findOneAndDelete({ _id: id, caregiverId }).lean();
    if (res) {
        (0, socket_1.emitToCaregiver)(caregiverId, 'member_deleted', { id });
        logger_1.logger.info('protected_member.deleted', { caregiverId, memberId: id });
    }
    return res;
}
