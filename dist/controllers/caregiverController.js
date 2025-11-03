"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signup = signup;
exports.login = login;
exports.me = me;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const caregiverService_1 = require("../services/caregiverService");
async function signup(req, res) {
    const { name, email, password } = req.body;
    const user = await (0, caregiverService_1.signupCaregiver)(name, email, password);
    res.status(201).json({ id: user._id, name: user.name, email: user.email, createdAt: user.createdAt });
}
async function login(req, res) {
    const { email, password } = req.body;
    const user = await (0, caregiverService_1.findCaregiverByEmail)(email);
    if (!user)
        return res.status(401).json({ error: { message: 'Invalid credentials' } });
    const ok = await (0, caregiverService_1.verifyPassword)(user, password);
    if (!ok)
        return res.status(401).json({ error: { message: 'Invalid credentials' } });
    const token = jsonwebtoken_1.default.sign({ sub: user._id.toString(), email: user.email, role: 'caregiver' }, process.env.JWT_SECRET || '');
    res.json({ accessToken: token, caregiver: { id: user._id, name: user.name, email: user.email } });
}
async function me(req, res) {
    // req.user injected by auth middleware
    const user = req.user;
    res.json({ id: user.id, email: user.email });
}
