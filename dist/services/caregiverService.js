"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signupCaregiver = signupCaregiver;
exports.findCaregiverByEmail = findCaregiverByEmail;
exports.verifyPassword = verifyPassword;
exports.findOrCreateBySupabaseId = findOrCreateBySupabaseId;
const bcrypt_1 = __importDefault(require("bcrypt"));
const Caregiver_1 = require("../models/Caregiver");
async function signupCaregiver(name, email, password) {
    const existing = await Caregiver_1.Caregiver.findOne({ email }).lean();
    if (existing)
        throw { status: 400, message: 'Email already in use' };
    const hash = await bcrypt_1.default.hash(password, 10);
    const created = await Caregiver_1.Caregiver.create({ name, email, passwordHash: hash });
    return created.toObject();
}
async function findCaregiverByEmail(email) {
    return Caregiver_1.Caregiver.findOne({ email }).lean();
}
async function verifyPassword(caregiver, password) {
    if (!caregiver.passwordHash)
        return false;
    return bcrypt_1.default.compare(password, caregiver.passwordHash);
}
async function findOrCreateBySupabaseId(supabaseId, attrs) {
    // Try to find by supabaseId first
    let existing = await Caregiver_1.Caregiver.findOne({ supabaseId }).lean();
    if (existing)
        return existing;
    // Fallback: if an account with same email exists, link it (do not overwrite passwordHash)
    if (attrs.email) {
        existing = await Caregiver_1.Caregiver.findOne({ email: attrs.email }).lean();
        if (existing) {
            // link existing document
            await Caregiver_1.Caregiver.updateOne({ _id: existing._id }, { $set: { supabaseId } });
            return { ...existing, supabaseId };
        }
    }
    // Create minimal caregiver record (no passwordHash)
    const created = await Caregiver_1.Caregiver.create({ name: attrs.name || 'Supabase User', email: attrs.email || `${supabaseId}@supabase`, supabaseId });
    return created.toObject();
}
